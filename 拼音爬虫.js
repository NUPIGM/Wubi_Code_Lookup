const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * --- 用户配置区 ---
 */
const INPUT_FILE = 'unique_hanzi.txt';
const CHAR_JSON_DIR = './wubi_data';
const AUDIO_DIR = './audios';
const DELAY_MS = 3000; // 稍微增加延迟，保护连接
const MAX_RETRIES = 3;

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试和防崩溃保护的 HTTPS GET
 */
function fetchWithRetry(char, attempt = 1) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.zdic.net',
            path: encodeURI(`/hans/${char}`),
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://www.zdic.net/',
                'Connection': 'close' // 请求完即关闭，防止因保持长连接导致的 RESET
            },
            timeout: 15000
        };

        const req = https.get(options, (res) => {
            res.setEncoding('utf8');
            let html = '';
            res.on('data', (chunk) => { html += chunk; });
            res.on('end', () => resolve(html));
            res.on('error', (err) => reject(err)); // 捕获响应流错误
        });

        req.on('error', async (err) => {
            if ((err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') && attempt <= MAX_RETRIES) {
                console.log(`   ⚠️ 网络异常 (${err.code})，正在重试 [${attempt}/${MAX_RETRIES}]...`);
                await sleep(DELAY_MS * attempt);
                try {
                    const retryResult = await fetchWithRetry(char, attempt + 1);
                    resolve(retryResult);
                } catch (retryErr) {
                    reject(retryErr);
                }
            } else {
                reject(err);
            }
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

/**
 * 下载音频，增加错误监听
 */
function downloadFile(url, dest) {
    if (fs.existsSync(dest)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });
        
        req.on('error', (err) => {
            file.end();
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log('--- 爬虫启动 ---');
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`错误：找不到 ${INPUT_FILE}`);
        process.exit(1);
    }

    const hanziList = fs.readFileSync(INPUT_FILE, 'utf8')
        .split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);

    for (let i = 0; i < hanziList.length; i++) {
        const char = hanziList[i];
        const jsonPath = path.join(CHAR_JSON_DIR, `${char}.json`);

        if (!fs.existsSync(jsonPath)) {
            console.log(`[跳过] 不存在 JSON: ${char}.json`);
            continue;
        }

        try {
            // 1. 读取并解析现有 JSON
            let charData;
            try {
                const raw = fs.readFileSync(jsonPath, 'utf8');
                charData = JSON.parse(raw);
            } catch (e) {
                console.error(`   ❌ ${char}.json 解析失败，跳过`);
                continue;
            }

            // 2. 断点续传
            if (charData.pinyin && charData.pinyin.length > 0) {
                console.log(`[完成] ${char} 已有数据`);
                continue;
            }

            console.log(`[${i + 1}/${hanziList.length}] 正在处理: ${char}`);

            // 3. 抓取数据
            const html = await fetchWithRetry(char);
            const regex = /<span class="z_d song">([^<]+)[\s\S]*?data-src-mp3="([^"]+)"/g;
            let match;
            const results = [];

            while ((match = regex.exec(html)) !== null) {
                results.push({
                    pinyin: match[1].trim(),
                    url: match[2].startsWith('//') ? 'https:' + match[2] : match[2]
                });
            }

            if (results.length > 0) {
                charData.pinyin = [];
                charData.mp3 = [];
                const seenPinyin = new Set();

                for (const item of results) {
                    const originalFileName = path.basename(new URL(item.url).pathname);
                    const decodedName = decodeURIComponent(originalFileName);
                    const destPath = path.join(AUDIO_DIR, decodedName);

                    // 物理下载
                    await downloadFile(item.url, destPath);

                    // 数据记录 (去后缀)
                    const nameWithoutExt = path.parse(decodedName).name;
                    if (!seenPinyin.has(item.pinyin)) {
                        seenPinyin.add(item.pinyin);
                        charData.pinyin.push(item.pinyin);
                        charData.mp3.push(nameWithoutExt);
                    }
                }

                // 4. 写回文件
                fs.writeFileSync(jsonPath, JSON.stringify(charData, null, 2), 'utf8');
                console.log(`   ✅ 成功更新 ${char}.json`);
            } else {
                console.log(`   ⚠️ 未抓取到拼音信息: ${char}`);
            }

        } catch (err) {
            // 核心：这里的 catch 保证了即使某个汉字彻底失败，也不会导致整个程序退出
            console.error(`   ❌ ${char} 处理中断: ${err.message}`);
        }

        // 5. 强制延迟
        await sleep(DELAY_MS);
    }

    console.log('\n--- 任务结束 ---');
}

// 捕获可能遗漏的全局异常，防止进程无声退出
process.on('unhandledRejection', (reason, promise) => {
    console.error('未捕获的异步拒绝:', reason);
});

main();
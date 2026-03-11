const fs = require('fs');
const http = require('http');
const path = require('path');

const CONFIG = {
    inputFilePath: './unique_hanzi.txt',
    outputDir: './result_json',
    baseUrl: 'http://www.wangma.net.cn/search_result.aspx?sm=7&v=3879&s=',
    delay: 1000,
    options: {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
            'Referer': 'http://www.wangma.net.cn/',
            'Cookie': 'ASP.NET_SessionId=atiesjrumtezmi5bzvd1cgmq'
        }
    }                    
};

if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir);
}

/**
 * 核心解析函数
 */
function parseHtml(html, word) {
    const result = {
        word: word,
        "86": { edition: "86", code: "", img: [] },
        "98": { edition: "98", code: "", img: [] },
        "06": { edition: "06", code: "", img: [] }
    };

    // 匹配三个版本的正则表达式
    const reg86 = /86版[\s\S]*?：<\/li>\s*<li>([A-Z]+)\(([\s\S]*?)\)/;
    const reg98 = /98版[\s\S]*?：<\/li>\s*<li>([A-Z]+)\(([\s\S]*?)\)/;
    const reg06 = /新世纪版[\s\S]*?：<\/li>\s*<li>([A-Z]+)\(([\s\S]*?)\)/;

    const match86 = html.match(reg86);
    const match98 = html.match(reg98);
    const match06 = html.match(reg06);

    /**
     * 修改点：提取图片文件名并存入纯字符串数组
     */
    const extractImgsToArray = (imgHtml) => {
        const imgList = [];
        // 匹配类似 /T01.bmp 中的 T01 部分
        const imgReg = /\/([A-Z]\d+)\.bmp/g; 
        let m;
        while ((m = imgReg.exec(imgHtml)) !== null) {
            imgList.push(m[1]); // 直接推入文件名字符串，如 "T01"
        }
        return imgList;
    };

    if (match86) {
        result["86"].code = match86[1];
        result["86"].img = extractImgsToArray(match86[2]);
    }
    if (match98) {
        result["98"].code = match98[1];
        result["98"].edition = "98"; // 统一 edition 标识
        result["98"].img = extractImgsToArray(match98[2]);
    }
    if (match06) {
        result["06"].code = match06[1];
        result["06"].edition = "06";
        result["06"].img = extractImgsToArray(match06[2]);
    }

    return result;
}

/**
 * 封装请求函数
 */
function fetchWord(word) {
    return new Promise((resolve, reject) => {
        const url = CONFIG.baseUrl + encodeURIComponent(word);
        
        http.get(url, CONFIG.options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf-8');
                resolve(parseHtml(data, word));
            });
        }).on('error', (err) => reject(err));
    });
}

async function main() {
    try {
        const content = fs.readFileSync(CONFIG.inputFilePath, 'utf-8');
        const words = content.split(/\r?\n/).filter(w => w.trim() !== '');

        console.log(`🚀 开始处理，共 ${words.length} 个字...`);

        for (const word of words) {
            try {
                console.log(`正在抓取: ${word}`);
                const result = await fetchWord(word);
                
                const fileName = path.join(CONFIG.outputDir, `${word}.json`);
                fs.writeFileSync(fileName, JSON.stringify(result, null, 2), 'utf-8');
                
                // 适当延迟，防止请求过快
                await new Promise(resolve => setTimeout(resolve, CONFIG.delay));
            } catch (err) {
                console.error(`❌ 字 [${word}] 处理失败:`, err.message);
            }
        }
        console.log('✅ 所有任务完成！');
    } catch (err) {
        console.error('运行出错:', err);
    }
}

main();
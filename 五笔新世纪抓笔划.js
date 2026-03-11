const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置参数
const BASE_URL = 'http://www.wangma.net.cn/WMZG/root86/';
const SAVE_DIR = './downloads';

// 如果目录不存在则创建
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR);
}

async function downloadFile(letter, number) {
    // 格式化数字为两位数 (01, 02...)
    const numStr = number.toString().padStart(2, '0');
    const fileName = `${letter}${numStr}.bmp`;
    const url = `${BASE_URL}${fileName}`;
    const filePath = path.join(SAVE_DIR, fileName);

    return new Promise((resolve) => {
        http.get(url, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filePath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`[成功] 已保存: ${fileName}`);
                    resolve();
                });
            } else {
                // 404 或其他错误直接跳过
                if (res.statusCode === 404) {
                    console.warn(`[跳过] 文件不存在: ${fileName}`);
                } else {
                    console.error(`[错误] ${fileName} 状态码: ${res.statusCode}`);
                }
                res.resume(); // 消耗响应流以释放内存
                resolve();
            }
        }).on('error', (err) => {
            console.error(`[异常] 请求 ${fileName} 失败: ${err.message}`);
            resolve();
        });
    });
}

async function startBatchDownload() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
    
    for (const char of letters) {
        for (let i = 1; i <= 50; i++) {
            // 使用 await 确保按顺序请求，避免瞬间并发过高导致服务器拦截
            await downloadFile(char, i);
        }
    }
    console.log('--- 所有任务处理完毕 ---');
}

startBatchDownload();
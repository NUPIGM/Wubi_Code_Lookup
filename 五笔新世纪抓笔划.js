const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://www.wangma.net.cn/WMZG/root98/';
const SAVE_DIR = './downloads';

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

async function downloadFile(letter) {
    // 锁定数字为 00
    const fileName = `${letter}00.bmp`;
    const url = `${BASE_URL}${fileName}`;
    const filePath = path.join(SAVE_DIR, fileName);

    return new Promise((resolve) => {
        http.get(url, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filePath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`[成功] 已下载: ${fileName}`);
                    resolve();
                });
            } else {
                // 404 或其他错误直接跳过
                res.resume();
                console.log(`[跳过] ${fileName} (状态码: ${res.statusCode})`);
                resolve();
            }
        }).on('error', (err) => {
            console.error(`[失败] ${fileName}: ${err.message}`);
            resolve();
        });
    });
}

async function start() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    
    console.log('开始批量下载 A00 - Z00...');
    
    for (const char of letters) {
        // 只循环字母，不再嵌套数字循环
        await downloadFile(char);
    }
    
    console.log('--- 任务执行完毕 ---');
}

start();
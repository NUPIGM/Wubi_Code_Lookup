const fs = require('fs');
const path = require('path');

// 1. 设置你的数据目录
const dataDir = 'wubi_data'; 

// 2. 递归处理 JSON 对象的函数
function transformData(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => transformData(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      let newKey = key;
      let value = obj[key];

      // 修改键名：img -> imgs
      if (key === 'img') newKey = 'imgs';
      // 修改键名：mp3 -> audios
      else if (key === 'mp3') newKey = 'audios';

      // 处理音频文件名：去除 .mp3 后缀
      if (newKey === 'audios' && Array.isArray(value)) {
        value = value.map(filename => 
          typeof filename === 'string' ? filename.replace(/\.mp3$/i, '') : filename
        );
      } else {
        // 递归处理嵌套对象（如 86/98/06 内部）
        value = transformData(value);
      }

      newObj[newKey] = value;
    }
    return newObj;
  }
  return obj;
}

// 3. 读取并处理文件
async function processFiles() {
  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    console.log(`🚀 开始处理 ${files.length} 个文件...`);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const rawData = fs.readFileSync(filePath, 'utf8');
      
      const jsonData = JSON.parse(rawData);
      const updatedData = transformData(jsonData);

      // 写回文件（保持 2 空格缩进以维持可读性）
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
    }

    console.log('✅ 批量修改完成！');
  } catch (err) {
    console.error('❌ 处理出错:', err);
  }
}

processFiles();
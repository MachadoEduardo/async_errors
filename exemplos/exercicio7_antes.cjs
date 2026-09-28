const fs = require('node:fs');

function readConfig(path) {
  try {
    fs.promises.readFile(path, 'utf-8').then((content) => {
      console.log('config carregada', JSON.parse(content));
    });
  } catch (error) {
    console.error('falha ao ler config', error);
  }
}

function retryLater() {
  setTimeout(() => {
    throw new Error('tentativa de releitura falhou');
  }, 200);
}

readConfig('./config/app.json');
retryLater();

const chokidar = require('chokidar');
const path = require('path');
const logger = require('../utils/logger');
const fileProcessorService = require('./fileProcessorService');

class FileWatcherService {
  constructor() {
    this.watcher = null;
  }

  start() {
    const watchDir = process.env.INCOMING_DIR;
    
    if (!watchDir) {
      logger.warn('INCOMING_DIR not set, skipping file watcher');
      return;
    }
    
    logger.info(`Starting file watcher on directory: ${watchDir}`);
    
    this.watcher = chokidar.watch(path.join(watchDir, '*.json'), {
      ignored: /^\./, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', async (filePath) => {
        logger.info(`File detected: ${path.basename(filePath)}`);
        await fileProcessorService.processFile(filePath);
      })
      .on('error', (error) => {
        logger.error('File watcher error:', error);
      });

    logger.info('File watcher started successfully');
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      logger.info('File watcher stopped');
    }
  }
}

module.exports = new FileWatcherService();
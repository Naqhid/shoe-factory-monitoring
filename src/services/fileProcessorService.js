const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const stitchingEventRepository = require('../repositories/stitchingEventRepository');

class FileProcessorService {
  constructor() {
    this.processedFiles = new Set();
  }

  async processFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Prevent double processing
    if (this.processedFiles.has(fileName)) {
      logger.info(`File ${fileName} already processed, skipping`);
      return;
    }

    logger.info(`Processing file: ${fileName}`);
    
    try {
      // Read and parse JSON
      const fileContent = await fs.readFile(filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      // Validate structure
      if (!this.validateJsonStructure(jsonData)) {
        throw new Error('Invalid JSON structure');
      }

      // Insert events to database
      const result = await stitchingEventRepository.insertEvents(jsonData.data, fileName);
      
      logger.info(`Successfully inserted ${result.insertedCount} events from ${fileName}`);
      
      // Move to success directory
      await this.moveFile(filePath, process.env.SUCCESS_DIR);
      this.processedFiles.add(fileName);
      
      logger.info(`File ${fileName} moved to success directory`);
      
    } catch (error) {
      logger.error(`Error processing file ${fileName}:`, error);
      
      // Move to failure directory
      try {
        await this.moveFile(filePath, process.env.FAILURE_DIR);
        logger.info(`File ${fileName} moved to failure directory`);
      } catch (moveError) {
        logger.error(`Failed to move file ${fileName} to failure directory:`, moveError);
      }
    }
  }

  validateJsonStructure(jsonData) {
    if (!jsonData || !Array.isArray(jsonData.data)) {
      return false;
    }

    for (const record of jsonData.data) {
      if (!record.machine_id || typeof record.machine_id !== 'string' || record.machine_id.trim() === '') {
        return false;
      }
      if (record.status !== 0 && record.status !== 1) {
        return false;
      }
    }

    return true;
  }

  async moveFile(sourcePath, targetDir) {
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);
    
    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Move file
    await fs.rename(sourcePath, targetPath);
  }
}

module.exports = new FileProcessorService();
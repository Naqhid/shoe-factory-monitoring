-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 192.168.5.47    Database: florence
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alert_reads`
--

DROP TABLE IF EXISTS `alert_reads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alert_reads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alert_id` int NOT NULL,
  `user_id` int NOT NULL,
  `read_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_alert_user` (`alert_id`,`user_id`),
  KEY `idx_user_read` (`user_id`,`read_at`),
  CONSTRAINT `fk_alert_reads_alert` FOREIGN KEY (`alert_id`) REFERENCES `production_alerts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alert_reads`
--

LOCK TABLES `alert_reads` WRITE;
/*!40000 ALTER TABLE `alert_reads` DISABLE KEYS */;
INSERT INTO `alert_reads` VALUES (1,9,1,'2026-04-14 16:40:44'),(2,10,1,'2026-04-14 16:41:37'),(3,11,1,'2026-04-14 16:41:37'),(4,12,1,'2026-04-14 16:41:37'),(5,13,1,'2026-04-14 16:41:37'),(6,25,1,'2026-04-16 11:03:40'),(7,24,1,'2026-04-16 11:03:42');
/*!40000 ALTER TABLE `alert_reads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `colors`
--

DROP TABLE IF EXISTS `colors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `colors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `colors`
--

LOCK TABLES `colors` WRITE;
/*!40000 ALTER TABLE `colors` DISABLE KEYS */;
INSERT INTO `colors` VALUES (1,'Mulberry','Mulberry','2026-03-09 10:57:44','2026-04-08 08:02:17');
/*!40000 ALTER TABLE `colors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'GB','Gabor','2026-03-09 10:56:58','2026-03-09 10:56:58');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `work_centre_id` int DEFAULT NULL,
  `machine_centre_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `work_centre_id` (`work_centre_id`),
  KEY `machine_centre_id` (`machine_centre_id`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`),
  CONSTRAINT `employees_ibfk_2` FOREIGN KEY (`machine_centre_id`) REFERENCES `machine_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (3,'278','K. Suganthi',5,NULL,'2026-04-10 04:09:10','2026-04-10 06:24:15'),(4,'85','S. Juli',5,NULL,'2026-04-10 04:09:26','2026-04-10 06:24:15'),(5,'724','P. Poornima',5,NULL,'2026-04-10 04:09:40','2026-04-10 06:24:15'),(6,'108','P. Bharathi',5,NULL,'2026-04-10 04:09:57','2026-04-10 06:24:15'),(7,'346','K. Latha',5,NULL,'2026-04-10 04:10:14','2026-04-10 06:24:15'),(8,'580','G. Powlina',5,NULL,'2026-04-10 04:10:46','2026-04-10 06:24:15'),(9,'709','J. Devi',5,NULL,'2026-04-10 04:10:59','2026-04-10 06:24:15'),(11,'165','S. Mythi',5,NULL,'2026-04-15 09:14:57','2026-04-15 10:40:00');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forms_master`
--

DROP TABLE IF EXISTS `forms_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forms_master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forms_master`
--

LOCK TABLES `forms_master` WRITE;
/*!40000 ALTER TABLE `forms_master` DISABLE KEYS */;
/*!40000 ALTER TABLE `forms_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groups_master`
--

DROP TABLE IF EXISTS `groups_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groups_master` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groups_master`
--

LOCK TABLES `groups_master` WRITE;
/*!40000 ALTER TABLE `groups_master` DISABLE KEYS */;
INSERT INTO `groups_master` VALUES (1,'GB','6024','2026-03-09 11:04:30','2026-04-08 08:00:50');
/*!40000 ALTER TABLE `groups_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leather`
--

DROP TABLE IF EXISTS `leather`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leather` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leather`
--

LOCK TABLES `leather` WRITE;
/*!40000 ALTER TABLE `leather` DISABLE KEYS */;
INSERT INTO `leather` VALUES (1,'GS','Goat Suede','2026-03-09 10:58:53','2026-03-09 10:58:53');
/*!40000 ALTER TABLE `leather` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `line_setup`
--

DROP TABLE IF EXISTS `line_setup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `line_setup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `login_date_time` datetime NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_centre_id` int NOT NULL,
  `smv_per_pair` decimal(10,4) NOT NULL,
  `logout_date_time` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `work_centre_id` (`work_centre_id`),
  KEY `machine_centre_id` (`machine_centre_id`),
  CONSTRAINT `line_setup_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  CONSTRAINT `line_setup_ibfk_2` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`),
  CONSTRAINT `line_setup_ibfk_3` FOREIGN KEY (`machine_centre_id`) REFERENCES `machine_centres` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `line_setup`
--

LOCK TABLES `line_setup` WRITE;
/*!40000 ALTER TABLE `line_setup` DISABLE KEYS */;
/*!40000 ALTER TABLE `line_setup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_centre_app`
--

DROP TABLE IF EXISTS `machine_centre_app`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_centre_app` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` int NOT NULL,
  `emp_id` varchar(10) NOT NULL,
  `output_pairs` int DEFAULT '0',
  `target_mins` int NOT NULL,
  `start_time` datetime DEFAULT NULL,
  `finish_time` datetime DEFAULT NULL,
  `idle_start_time` datetime DEFAULT NULL,
  `idle_stop_time` datetime DEFAULT NULL,
  `idle_duration` int DEFAULT '0' COMMENT 'Total idle minutes',
  `actual_time` int DEFAULT '0' COMMENT 'Minutes elapsed',
  `button_status` int DEFAULT '1' COMMENT '1=Running, 2=Finished, 3=Stopped',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_machine_date` (`machine_id`,`prod_date`),
  KEY `idx_work_centre` (`work_centre_id`),
  KEY `idx_status` (`button_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_app`
--

LOCK TABLES `machine_centre_app` WRITE;
/*!40000 ALTER TABLE `machine_centre_app` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_centre_app` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_centre_production`
--

DROP TABLE IF EXISTS `machine_centre_production`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_centre_production` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `emp_id` varchar(10) NOT NULL,
  `output_pairs` int DEFAULT '12' COMMENT 'Output pairs (normally 12 per entry)',
  `target_mins` decimal(10,2) NOT NULL COMMENT 'Target time in minutes',
  `start_time` datetime DEFAULT NULL COMMENT 'Production Start Time',
  `finish_time` datetime DEFAULT NULL COMMENT 'Production Finish Time',
  `idle_start_time` datetime DEFAULT NULL COMMENT 'Idle Start Time',
  `idle_stop_time` datetime DEFAULT NULL COMMENT 'Idle Stop Time',
  `stoppage_reason` varchar(100) DEFAULT NULL,
  `actual_time` decimal(10,2) GENERATED ALWAYS AS (coalesce((timestampdiff(SECOND,`start_time`,`finish_time`) / 60.0),0)) STORED,
  `idle_mins` decimal(10,2) GENERATED ALWAYS AS (coalesce((timestampdiff(SECOND,`idle_start_time`,`idle_stop_time`) / 60.0),0)) STORED,
  `button_status` int DEFAULT '1' COMMENT '1 = Start / 2 = Finish / 3 = Stop',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prod_date` (`prod_date`),
  KEY `idx_machine_id` (`machine_id`),
  KEY `idx_work_centre` (`work_centre_id`),
  KEY `idx_status` (`button_status`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Raw production entries - per 12 pairs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_production`
--

LOCK TABLES `machine_centre_production` WRITE;
/*!40000 ALTER TABLE `machine_centre_production` DISABLE KEYS */;
INSERT INTO `machine_centre_production` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `output_pairs`, `target_mins`, `start_time`, `finish_time`, `idle_start_time`, `idle_stop_time`, `stoppage_reason`, `button_status`, `created_at`, `updated_at`) VALUES (1,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:06:27','2026-03-23 15:06:52',NULL,NULL,NULL,2,'2026-03-23 09:36:27','2026-03-23 09:36:52'),(2,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:07:38','2026-03-23 15:07:53',NULL,NULL,NULL,2,'2026-03-23 09:37:38','2026-03-23 09:37:53'),(3,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:08:36','2026-03-23 15:09:29',NULL,NULL,NULL,2,'2026-03-23 09:38:36','2026-03-23 09:39:29'),(4,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:01','2026-03-23 15:24:08','2026-03-23 15:16:21','2026-03-23 15:24:01',NULL,2,'2026-03-23 09:46:08','2026-03-23 09:54:08'),(5,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:46','2026-03-23 15:24:53',NULL,NULL,NULL,2,'2026-03-23 09:54:46','2026-03-23 09:54:53'),(6,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:58','2026-03-23 15:25:05',NULL,NULL,NULL,2,'2026-03-23 09:54:58','2026-03-23 09:55:05'),(7,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:25:11','2026-03-23 15:25:13',NULL,NULL,NULL,2,'2026-03-23 09:55:11','2026-03-23 09:55:13'),(8,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 06:00:00','2026-04-07 06:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(9,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 06:30:00','2026-04-07 06:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(10,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 07:00:00','2026-04-07 07:20:00','2026-04-07 07:20:00','2026-04-07 07:35:00',NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(11,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 08:00:00','2026-04-07 08:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(12,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 09:00:00','2026-04-07 09:30:00','2026-04-07 09:30:00','2026-04-07 09:45:00',NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(13,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 10:00:00','2026-04-07 10:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(14,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 11:00:00','2026-04-07 11:20:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(15,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 12:00:00','2026-04-07 12:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(16,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 13:00:00','2026-04-07 13:30:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(17,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 06:15:00','2026-04-07 06:40:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(18,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 07:00:00','2026-04-07 07:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(19,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 08:30:00','2026-04-07 08:50:00','2026-04-07 08:00:00','2026-04-07 08:30:00',NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(20,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 09:15:00','2026-04-07 09:40:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(21,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 10:30:00','2026-04-07 10:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(22,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 11:30:00','2026-04-07 11:50:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(23,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 12:30:00','2026-04-07 12:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(24,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 13:15:00','2026-04-07 13:40:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(25,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 14:00:00','2026-04-07 14:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(26,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 15:00:00','2026-04-07 15:20:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(27,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 16:00:00','2026-04-07 16:30:00','2026-04-07 16:30:00','2026-04-07 16:45:00',NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(28,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 17:00:00','2026-04-07 17:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(29,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 18:00:00','2026-04-07 18:20:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(30,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 19:00:00','2026-04-07 19:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(31,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 20:00:00','2026-04-07 20:30:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(32,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 21:00:00','2026-04-07 21:25:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(33,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 14:30:00','2026-04-07 14:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(34,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 15:30:00','2026-04-07 15:50:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(35,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 16:45:00','2026-04-07 17:10:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(36,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 18:30:00','2026-04-07 18:50:00','2026-04-07 17:30:00','2026-04-07 18:30:00',NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(37,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 19:30:00','2026-04-07 19:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(38,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 20:30:00','2026-04-07 20:50:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(39,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 21:30:00','2026-04-07 21:55:00',NULL,NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(40,'2026-04-08',4,'MAC-001','EMP-1001',12,0.41,'2026-04-08 11:05:31','2026-04-08 11:05:40','2026-04-08 11:03:44','2026-04-08 11:05:31',NULL,2,'2026-04-08 05:33:38','2026-04-08 05:35:40'),(41,'2026-04-09',5,'01','EMP-1001',12,16.60,'2026-04-09 16:53:57','2026-04-09 16:54:09',NULL,NULL,NULL,2,'2026-04-09 11:23:57','2026-04-09 11:24:09'),(42,'2026-04-09',5,'01','EMP-1001',12,16.60,'2026-04-09 17:08:30','2026-04-09 17:08:39',NULL,NULL,NULL,2,'2026-04-09 11:38:30','2026-04-09 11:38:39'),(43,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 09:45:26','2026-04-10 09:45:49',NULL,NULL,NULL,2,'2026-04-10 04:15:26','2026-04-10 10:09:14'),(44,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 10:32:09','2026-04-10 10:32:17',NULL,NULL,NULL,2,'2026-04-10 05:02:09','2026-04-10 10:09:14'),(45,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 10:33:19','2026-04-10 10:33:22',NULL,NULL,NULL,2,'2026-04-10 05:03:19','2026-04-10 10:09:14'),(46,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 11:15:26','2026-04-10 11:21:31',NULL,NULL,NULL,2,'2026-04-10 05:45:26','2026-04-10 05:51:31'),(47,'2026-04-10',5,'02','85',12,72.24,'2026-04-10 11:46:39','2026-04-10 11:46:51',NULL,NULL,NULL,2,'2026-04-10 06:16:39','2026-04-10 06:16:51'),(48,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 11:46:56','2026-04-11 11:47:06',NULL,NULL,NULL,2,'2026-04-11 06:16:56','2026-04-11 06:17:06'),(49,'2026-04-11',5,'02','709',12,16.60,'2026-04-11 11:47:15','2026-04-11 11:47:20',NULL,NULL,NULL,2,'2026-04-11 06:17:15','2026-04-11 06:17:20'),(50,'2026-04-11',5,'03','724',12,16.60,'2026-04-11 11:47:27','2026-04-11 11:47:31',NULL,NULL,NULL,2,'2026-04-11 06:17:27','2026-04-11 06:17:31'),(51,'2026-04-11',5,'04','580',12,16.60,'2026-04-11 11:47:39','2026-04-11 11:47:44',NULL,NULL,NULL,2,'2026-04-11 06:17:39','2026-04-11 06:17:44'),(52,'2026-04-11',5,'05','108',12,16.60,'2026-04-11 11:47:54','2026-04-11 11:48:03',NULL,NULL,NULL,2,'2026-04-11 06:17:54','2026-04-11 06:18:03'),(53,'2026-04-11',5,'06','346',12,16.60,'2026-04-11 11:48:19','2026-04-11 11:48:25',NULL,NULL,NULL,2,'2026-04-11 06:18:19','2026-04-11 06:18:25'),(54,'2026-04-11',5,'07','85',12,16.60,'2026-04-11 11:48:33','2026-04-11 11:48:39',NULL,NULL,NULL,2,'2026-04-11 06:18:33','2026-04-11 06:18:39'),(55,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 15:54:24','2026-04-11 15:54:29',NULL,NULL,NULL,2,'2026-04-11 10:24:24','2026-04-11 10:24:29'),(56,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 15:55:09','2026-04-11 15:55:13',NULL,NULL,NULL,2,'2026-04-11 10:25:09','2026-04-11 10:25:13'),(57,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 15:55:52','2026-04-11 15:56:03',NULL,NULL,NULL,2,'2026-04-11 10:25:52','2026-04-11 10:26:03'),(58,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 15:56:38','2026-04-11 15:56:42',NULL,NULL,NULL,2,'2026-04-11 10:26:38','2026-04-11 10:26:42'),(59,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:19:14','2026-04-11 16:19:17','2026-04-11 16:18:31','2026-04-11 16:19:14','Power Cut',2,'2026-04-11 10:27:08','2026-04-11 10:49:17'),(60,'2026-04-11',5,'02','709',12,16.60,'2026-04-11 16:51:10','2026-04-11 16:51:30','2026-04-11 16:18:53','2026-04-11 16:51:10','Material Shortage',2,'2026-04-11 10:48:47','2026-04-11 11:21:30'),(61,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:28:04','2026-04-11 16:31:02',NULL,NULL,NULL,2,'2026-04-11 10:58:04','2026-04-11 11:01:02'),(62,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:31:18','2026-04-11 16:31:32',NULL,NULL,NULL,2,'2026-04-11 11:01:18','2026-04-11 11:01:32'),(63,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:32:17','2026-04-11 16:32:33',NULL,NULL,NULL,2,'2026-04-11 11:02:17','2026-04-11 11:02:33'),(64,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:34:11','2026-04-11 16:34:46',NULL,NULL,NULL,2,'2026-04-11 11:04:11','2026-04-11 11:04:46'),(65,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:34:57','2026-04-11 16:35:15',NULL,NULL,NULL,2,'2026-04-11 11:04:57','2026-04-11 11:05:15'),(66,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:37:05','2026-04-11 16:40:56',NULL,NULL,NULL,2,'2026-04-11 11:07:05','2026-04-11 11:10:56'),(67,'2026-04-11',5,'01','278',12,16.60,'2026-04-11 16:47:24','2026-04-11 16:47:29',NULL,NULL,NULL,2,'2026-04-11 11:17:24','2026-04-11 11:17:29'),(68,'2026-04-13',5,'01','85',12,16.60,'2026-04-13 10:46:18','2026-04-13 10:46:28',NULL,NULL,NULL,2,'2026-04-13 05:16:18','2026-04-13 05:16:28'),(69,'2026-04-14',5,'01','346',12,16.60,'2026-04-14 10:32:13','2026-04-14 10:32:25',NULL,NULL,NULL,2,'2026-04-14 05:02:13','2026-04-14 05:02:25'),(70,'2026-04-14',5,'01','346',12,16.60,'2026-04-14 10:38:07','2026-04-14 10:38:27',NULL,NULL,NULL,2,'2026-04-14 05:08:07','2026-04-14 05:08:27'),(71,'2026-04-14',5,'01','346',12,16.60,'2026-04-14 10:39:26','2026-04-14 10:39:39',NULL,NULL,NULL,2,'2026-04-14 05:09:26','2026-04-14 05:09:39'),(72,'2026-04-14',5,'01','346',12,16.60,'2026-04-14 10:41:17','2026-04-14 10:41:33',NULL,NULL,NULL,2,'2026-04-14 05:11:17','2026-04-14 05:11:33'),(73,'2026-04-14',5,'01','346',12,16.60,'2026-04-14 10:55:25','2026-04-14 10:55:37',NULL,NULL,NULL,2,'2026-04-14 05:25:25','2026-04-14 05:25:37'),(74,'2026-04-14',5,'02','346',12,16.60,'2026-04-14 11:25:07','2026-04-14 11:25:12',NULL,NULL,NULL,2,'2026-04-14 05:55:07','2026-04-14 05:55:12'),(75,'2026-04-14',5,'02','346',0,16.60,'2026-04-14 13:01:39',NULL,'2026-04-14 13:01:45',NULL,'Material Shortage',3,'2026-04-14 07:31:39','2026-04-14 07:31:45'),(76,'2026-04-14',5,'03','85',12,20.70,'2026-04-14 16:14:28','2026-04-14 16:14:38',NULL,NULL,NULL,2,'2026-04-14 10:44:28','2026-04-14 10:44:38'),(77,'2026-04-15',5,'01','165',12,36.85,'2026-04-15 14:57:34','2026-04-15 15:01:32',NULL,NULL,NULL,2,'2026-04-15 09:27:34','2026-04-15 09:31:32'),(78,'2026-04-15',5,'06','724',12,50.30,'2026-04-15 15:00:08','2026-04-15 15:00:55',NULL,NULL,NULL,2,'2026-04-15 09:30:08','2026-04-15 09:30:55'),(79,'2026-04-15',5,'01','165',12,36.85,'2026-04-15 15:04:38','2026-04-15 15:32:45',NULL,NULL,NULL,2,'2026-04-15 09:34:38','2026-04-15 10:02:45'),(80,'2026-04-15',5,'01','165',12,36.85,'2026-04-15 15:34:29','2026-04-15 16:24:25',NULL,NULL,NULL,2,'2026-04-15 10:04:29','2026-04-15 10:54:25'),(81,'2026-04-16',5,'06','724',12,50.30,'2026-04-16 09:19:49','2026-04-16 09:38:05',NULL,NULL,NULL,2,'2026-04-16 03:49:49','2026-04-16 04:08:05'),(82,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 09:39:45','2026-04-16 09:40:00',NULL,NULL,NULL,2,'2026-04-16 04:09:45','2026-04-16 04:10:00'),(83,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 09:40:10','2026-04-16 10:05:56',NULL,NULL,NULL,2,'2026-04-16 04:10:10','2026-04-16 04:35:56'),(84,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 10:13:02','2026-04-16 10:41:14',NULL,NULL,NULL,2,'2026-04-16 04:43:02','2026-04-16 05:11:14'),(85,'2026-04-16',5,'06','724',12,28.15,'2026-04-16 10:24:05','2026-04-16 10:44:25',NULL,NULL,NULL,2,'2026-04-16 04:54:05','2026-04-16 05:14:25'),(86,'2026-04-16',5,'06','724',12,28.15,'2026-04-16 11:10:06','2026-04-16 12:06:30',NULL,NULL,NULL,2,'2026-04-16 05:40:06','2026-04-16 06:36:30'),(87,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 11:12:06','2026-04-16 11:13:20',NULL,NULL,NULL,2,'2026-04-16 05:42:06','2026-04-16 05:43:20'),(88,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 11:34:29','2026-04-16 11:57:54',NULL,NULL,NULL,2,'2026-04-16 06:04:29','2026-04-16 06:27:54'),(89,'2026-04-16',5,'06','724',12,28.15,'2026-04-16 12:17:11','2026-04-16 12:17:32',NULL,NULL,NULL,2,'2026-04-16 06:47:11','2026-04-16 06:47:32'),(90,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 12:33:12','2026-04-16 12:59:26',NULL,NULL,NULL,2,'2026-04-16 07:03:12','2026-04-16 07:29:26'),(91,'2026-04-16',5,'06','724',12,28.15,'2026-04-16 12:33:31','2026-04-16 12:33:34',NULL,NULL,NULL,2,'2026-04-16 07:03:31','2026-04-16 07:03:34'),(92,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 14:00:34','2026-04-16 14:29:47',NULL,NULL,NULL,2,'2026-04-16 08:30:34','2026-04-16 08:59:47'),(93,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 14:38:46','2026-04-16 15:09:10',NULL,NULL,NULL,2,'2026-04-16 09:08:46','2026-04-16 09:39:10'),(94,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 15:18:17','2026-04-16 15:20:52',NULL,NULL,NULL,2,'2026-04-16 09:48:17','2026-04-16 09:50:52'),(95,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 15:20:58','2026-04-16 15:50:09',NULL,NULL,NULL,2,'2026-04-16 09:50:58','2026-04-16 10:20:09'),(96,'2026-04-16',5,'06','724',12,28.15,'2026-04-16 15:25:37','2026-04-16 15:42:12',NULL,NULL,NULL,2,'2026-04-16 09:55:37','2026-04-16 10:12:12'),(97,'2026-04-16',5,'01','165',12,36.85,'2026-04-16 17:05:28','2026-04-16 17:05:35',NULL,NULL,NULL,2,'2026-04-16 11:35:28','2026-04-16 11:35:35'),(98,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 09:06:19','2026-04-17 09:34:53',NULL,NULL,NULL,2,'2026-04-17 03:36:19','2026-04-17 04:04:53'),(99,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 09:20:35','2026-04-17 09:48:30',NULL,NULL,NULL,2,'2026-04-17 03:50:35','2026-04-17 04:18:30'),(100,'2026-04-16',5,'01','165',0,36.85,'2026-04-17 09:35:05',NULL,NULL,NULL,NULL,1,'2026-04-17 04:05:05','2026-04-17 04:05:05'),(101,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 09:41:39','2026-04-17 09:42:02',NULL,NULL,NULL,2,'2026-04-17 04:11:39','2026-04-17 04:12:02'),(102,'2026-04-16',5,'06','724',0,28.15,'2026-04-17 09:49:54',NULL,NULL,NULL,NULL,1,'2026-04-17 04:19:54','2026-04-17 04:19:54'),(103,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 10:09:28','2026-04-17 10:39:21',NULL,NULL,NULL,2,'2026-04-17 04:39:28','2026-04-17 05:09:21'),(104,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 10:10:21','2026-04-17 10:39:13',NULL,NULL,NULL,2,'2026-04-17 04:40:21','2026-04-17 05:09:13'),(105,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 10:39:19','2026-04-17 11:02:03',NULL,NULL,NULL,2,'2026-04-17 05:09:19','2026-04-17 05:32:03'),(106,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 10:39:45','2026-04-17 11:10:16',NULL,NULL,NULL,2,'2026-04-17 05:09:45','2026-04-17 05:40:16'),(107,'2026-04-16',5,'06','724',12,28.15,'2026-04-17 11:04:44','2026-04-17 11:05:00',NULL,NULL,NULL,2,'2026-04-17 05:34:44','2026-04-17 05:35:00'),(108,'2026-04-16',5,'06','724',12,28.15,'2026-04-17 11:05:10','2026-04-17 11:29:42',NULL,NULL,NULL,2,'2026-04-17 05:35:10','2026-04-17 05:59:42'),(109,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 11:26:02','2026-04-17 11:57:20',NULL,NULL,NULL,2,'2026-04-17 05:56:02','2026-04-17 06:27:20'),(110,'2026-04-16',5,'06','724',0,28.15,'2026-04-17 11:30:56',NULL,NULL,NULL,NULL,1,'2026-04-17 06:00:56','2026-04-17 06:00:56'),(111,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 13:19:15','2026-04-17 13:42:44',NULL,NULL,NULL,2,'2026-04-17 07:49:15','2026-04-17 08:12:44'),(112,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 13:31:08','2026-04-17 14:00:37',NULL,NULL,NULL,2,'2026-04-17 08:01:08','2026-04-17 08:30:37'),(113,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 14:05:38','2026-04-17 14:35:06',NULL,NULL,NULL,2,'2026-04-17 08:35:38','2026-04-17 09:05:06'),(114,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 14:13:18','2026-04-17 14:32:45',NULL,NULL,NULL,2,'2026-04-17 08:43:18','2026-04-17 09:02:45'),(115,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 14:35:13','2026-04-17 15:07:04',NULL,NULL,NULL,2,'2026-04-17 09:05:13','2026-04-17 09:37:04'),(116,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 14:42:09','2026-04-17 15:03:19',NULL,NULL,NULL,2,'2026-04-17 09:12:09','2026-04-17 09:33:19'),(117,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 15:03:28','2026-04-17 15:31:58',NULL,NULL,NULL,2,'2026-04-17 09:33:28','2026-04-17 10:01:58'),(118,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 15:07:10','2026-04-17 15:38:49',NULL,NULL,NULL,2,'2026-04-17 09:37:10','2026-04-17 10:08:49'),(119,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 15:47:27','2026-04-17 16:17:47',NULL,NULL,NULL,2,'2026-04-17 10:17:27','2026-04-17 10:47:47'),(120,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 16:09:41','2026-04-17 16:40:37',NULL,NULL,NULL,2,'2026-04-17 10:39:41','2026-04-17 11:10:37'),(121,'2026-04-17',5,'01','165',12,36.85,'2026-04-17 16:28:22','2026-04-17 16:59:03',NULL,NULL,NULL,2,'2026-04-17 10:58:22','2026-04-17 11:29:03'),(122,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 16:40:48','2026-04-17 17:06:04',NULL,NULL,NULL,2,'2026-04-17 11:10:48','2026-04-17 11:36:04'),(123,'2026-04-17',5,'06','724',12,28.15,'2026-04-17 17:06:37','2026-04-17 17:28:24',NULL,NULL,NULL,2,'2026-04-17 11:36:37','2026-04-17 11:58:24');
/*!40000 ALTER TABLE `machine_centre_production` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_centre_summary`
--

DROP TABLE IF EXISTS `machine_centre_summary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_centre_summary` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `emp_id` varchar(10) NOT NULL,
  `total_output_pairs` int DEFAULT '0' COMMENT 'SUM(output_pairs)',
  `total_target_mins` decimal(10,2) DEFAULT '0.00' COMMENT 'SUM(target_mins)',
  `total_actual_mins` decimal(10,2) DEFAULT '0.00' COMMENT 'SUM(actual_time)',
  `total_idle_mins` decimal(10,2) DEFAULT '0.00' COMMENT 'SUM(idle_mins)',
  `avg_efficiency_percent` decimal(8,2) GENERATED ALWAYS AS ((case when ((`total_actual_mins` + `total_idle_mins`) > 0) then least(((`total_target_mins` / (`total_actual_mins` + `total_idle_mins`)) * 100),9999.99) else 0 end)) STORED,
  `cum_avg_time` decimal(10,2) DEFAULT '0.00' COMMENT 'total_actual_mins / 12',
  `button_status` int DEFAULT '1' COMMENT 'Latest status (1/2/3)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_summary` (`prod_date`,`work_centre_id`,`machine_id`,`emp_id`),
  KEY `idx_summary_date` (`prod_date`),
  KEY `idx_summary_machine` (`machine_id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Summary/Pivot table aggregated from machine_centre_production';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_summary`
--

LOCK TABLES `machine_centre_summary` WRITE;
/*!40000 ALTER TABLE `machine_centre_summary` DISABLE KEYS */;
INSERT INTO `machine_centre_summary` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `total_output_pairs`, `total_target_mins`, `total_actual_mins`, `total_idle_mins`, `cum_avg_time`, `button_status`, `created_at`, `updated_at`) VALUES (81,'2026-04-17',5,'01','165',132,405.35,304.11,0.00,0.00,2,'2026-04-17 04:04:53','2026-04-17 11:29:03'),(83,'2026-04-17',5,'06','724',120,281.50,250.10,0.00,0.00,2,'2026-04-17 04:18:30','2026-04-17 11:58:24');
/*!40000 ALTER TABLE `machine_centre_summary` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`win-ebo7mqmm1pu`*/ /*!50003 TRIGGER `trg_alert_on_summary_insert` AFTER INSERT ON `machine_centre_summary` FOR EACH ROW BEGIN
  IF NEW.avg_efficiency_percent < 50 AND NEW.avg_efficiency_percent > 0 THEN
    INSERT INTO production_alerts
      (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
    VALUES (
      'efficiency_low', 'critical', NEW.work_centre_id, NEW.machine_id, NEW.prod_date,
      CONCAT('Machine ', NEW.machine_id, ' efficiency critically low at ', ROUND(NEW.avg_efficiency_percent, 1), '% (threshold: 50%)'),
      50, NEW.avg_efficiency_percent, 0
    );
  ELSEIF NEW.avg_efficiency_percent < 70 AND NEW.avg_efficiency_percent >= 50 THEN
    INSERT INTO production_alerts
      (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
    VALUES (
      'efficiency_low', 'warning', NEW.work_centre_id, NEW.machine_id, NEW.prod_date,
      CONCAT('Machine ', NEW.machine_id, ' efficiency below target at ', ROUND(NEW.avg_efficiency_percent, 1), '% (threshold: 70%)'),
      70, NEW.avg_efficiency_percent, 0
    );
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`win-ebo7mqmm1pu`*/ /*!50003 TRIGGER `trg_alert_on_summary_update` AFTER UPDATE ON `machine_centre_summary` FOR EACH ROW BEGIN
  IF NEW.avg_efficiency_percent <> OLD.avg_efficiency_percent THEN
    IF NEW.avg_efficiency_percent < 50 AND NEW.avg_efficiency_percent > 0 THEN
      INSERT INTO production_alerts
        (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
      VALUES (
        'efficiency_low', 'critical', NEW.work_centre_id, NEW.machine_id, NEW.prod_date,
        CONCAT('Machine ', NEW.machine_id, ' efficiency critically low at ', ROUND(NEW.avg_efficiency_percent, 1), '% (threshold: 50%)'),
        50, NEW.avg_efficiency_percent, 0
      );
    ELSEIF NEW.avg_efficiency_percent < 70 AND NEW.avg_efficiency_percent >= 50 THEN
      INSERT INTO production_alerts
        (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
      VALUES (
        'efficiency_low', 'warning', NEW.work_centre_id, NEW.machine_id, NEW.prod_date,
        CONCAT('Machine ', NEW.machine_id, ' efficiency below target at ', ROUND(NEW.avg_efficiency_percent, 1), '% (threshold: 70%)'),
        70, NEW.avg_efficiency_percent, 0
      );
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `machine_centre_summary_history`
--

DROP TABLE IF EXISTS `machine_centre_summary_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_centre_summary_history` (
  `id` int NOT NULL,
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `emp_id` varchar(10) NOT NULL,
  `total_output_pairs` int DEFAULT '0',
  `total_target_mins` decimal(10,2) DEFAULT '0.00',
  `total_actual_mins` decimal(10,2) DEFAULT '0.00',
  `total_idle_mins` decimal(10,2) DEFAULT '0.00',
  `avg_efficiency_percent` decimal(6,2) DEFAULT NULL,
  `cum_avg_time` decimal(10,2) DEFAULT '0.00',
  `button_status` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`,`prod_date`),
  KEY `idx_history_date` (`prod_date`),
  KEY `idx_history_machine` (`machine_id`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Historical data from machine_centre_summary';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_summary_history`
--

LOCK TABLES `machine_centre_summary_history` WRITE;
/*!40000 ALTER TABLE `machine_centre_summary_history` DISABLE KEYS */;
INSERT INTO `machine_centre_summary_history` VALUES (50,'2026-04-14',5,'01','346',60,83.00,1.22,0.00,6803.28,0.00,2,'2026-04-14 05:02:25','2026-04-14 05:25:37','2026-04-15 03:30:12'),(55,'2026-04-14',5,'02','346',12,16.60,0.08,0.00,9999.99,0.00,2,'2026-04-14 05:55:12','2026-04-14 05:55:12','2026-04-15 03:30:12'),(58,'2026-04-14',7,'12','E001',20,100.00,120.00,40.00,62.50,10.00,1,'2026-04-14 07:59:40','2026-04-14 07:59:40','2026-04-15 03:30:12'),(59,'2026-04-14',5,'03','85',12,20.70,0.17,0.00,9999.99,0.00,2,'2026-04-14 10:44:38','2026-04-14 10:44:38','2026-04-15 03:30:12'),(60,'2026-04-15',5,'06','724',12,50.30,0.78,0.00,6448.72,0.00,2,'2026-04-15 09:30:55','2026-04-15 09:30:55','2026-04-16 03:32:04'),(61,'2026-04-15',5,'01','165',36,110.55,82.02,0.00,134.78,0.00,2,'2026-04-15 09:31:32','2026-04-15 10:54:25','2026-04-16 03:32:04'),(64,'2026-04-16',5,'06','724',72,191.05,111.98,0.00,170.61,0.00,2,'2026-04-16 04:08:05','2026-04-16 10:12:12','2026-04-17 03:30:55'),(65,'2026-04-16',5,'01','165',132,405.35,196.60,0.00,206.18,0.00,2,'2026-04-16 04:10:00','2026-04-16 11:35:35','2026-04-17 03:30:55'),(87,'2026-04-16',5,'06','724',96,275.50,136.78,0.00,201.42,0.00,2,'2026-04-17 05:35:00','2026-04-17 05:59:42','2026-04-17 11:06:45');
/*!40000 ALTER TABLE `machine_centre_summary_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_centres`
--

DROP TABLE IF EXISTS `machine_centres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_centres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `work_centre_id` int DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `machine_name` varchar(255) DEFAULT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name_per_work_centre` (`work_centre_id`,`name`),
  UNIQUE KEY `unique_machine_id` (`machine_id`),
  KEY `work_centre_id` (`work_centre_id`),
  CONSTRAINT `machine_centres_ibfk_1` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centres`
--

LOCK TABLES `machine_centres` WRITE;
/*!40000 ALTER TABLE `machine_centres` DISABLE KEYS */;
INSERT INTO `machine_centres` VALUES (10,5,'05','Final Stitching','Final Stitching','05','2026-04-08 03:55:33','2026-04-14 06:23:02'),(11,5,'06','Counter Attaching','Counter Attaching','06','2026-04-08 04:02:56','2026-04-14 06:23:02'),(12,5,'07','Final Inspection','Final Inspection','07','2026-04-08 04:03:31','2026-04-15 07:49:38'),(13,5,'02','Toe Attaching','Toe Attaching','02','2026-04-08 04:04:35','2026-04-14 06:23:02'),(14,5,'03','Heelgrip attaching + collar attaching','Heelgrip attaching + collar attaching','03','2026-04-08 04:05:06','2026-04-14 05:56:23'),(18,5,'01','Eyelet Attaching','Eyelet Attaching','01','2026-04-08 08:07:43','2026-04-14 06:23:02'),(19,5,'04','Folding','Folding','04','2026-04-08 11:14:37','2026-04-14 06:23:02');
/*!40000 ALTER TABLE `machine_centres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mobile_sessions`
--

DROP TABLE IF EXISTS `mobile_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mobile_sessions` (
  `session_id` varchar(36) NOT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `status` enum('waiting','active','expired') DEFAULT 'waiting',
  `work_centre_id` int DEFAULT NULL,
  `emp_id` int DEFAULT NULL,
  `emp_code` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `activated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`session_id`),
  KEY `idx_session_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mobile_sessions`
--

LOCK TABLES `mobile_sessions` WRITE;
/*!40000 ALTER TABLE `mobile_sessions` DISABLE KEYS */;
INSERT INTO `mobile_sessions` VALUES ('1cffe817-d7d7-45f5-a61c-bd26cfb3ec71','06','active',5,5,'724','2026-04-11 06:06:47','2026-04-17 03:47:23'),('245f14b4-dbe3-4b08-aa7a-3d920f8776ec','05','active',5,6,'108','2026-04-11 06:06:15','2026-04-11 06:06:15'),('3338ac1b-9176-45cb-b64a-40edb79f075e','04','active',5,8,'580','2026-04-11 06:05:33','2026-04-11 06:05:33'),('41da75f2-b9ca-4ce8-a41f-d1388a34ccb3','01','active',5,11,'165','2026-04-09 09:13:51','2026-04-17 03:35:51'),('af3fa881-3743-4bc8-9345-7bd25eee1d09','03','active',5,4,'85','2026-04-11 06:04:58','2026-04-14 10:42:23'),('da74b0b1-7bf5-4660-9c98-021d2ae848c1','07','active',5,9,'709','2026-04-11 06:07:25','2026-04-14 05:15:42'),('eef3fb56-07aa-4003-ac61-2179f8d27a77','02','active',5,7,'346','2026-04-10 06:16:31','2026-04-14 05:06:01'),('fbd045ca-efb2-40ae-9d17-cbf334de6845','MAC-001','active',4,1,'EMP-1001','2026-03-23 09:35:36','2026-04-08 05:33:17');
/*!40000 ALTER TABLE `mobile_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pivot_data`
--

DROP TABLE IF EXISTS `pivot_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pivot_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(50) NOT NULL DEFAULT 'Prod Data',
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `emp_id` int NOT NULL,
  `output_pairs` int DEFAULT '0',
  `target_mins` int DEFAULT '0',
  `actual_time` int DEFAULT '0',
  `cum_avg_time` int DEFAULT '0',
  `button_status` tinyint DEFAULT '1',
  `target_pairs_per_tray` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pivot_prod_date` (`prod_date`),
  KEY `idx_pivot_machine_id` (`machine_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pivot_data`
--

LOCK TABLES `pivot_data` WRITE;
/*!40000 ALTER TABLE `pivot_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `pivot_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prod_data`
--

DROP TABLE IF EXISTS `prod_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prod_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prod_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `machine_id` varchar(100) NOT NULL,
  `emp_id` int NOT NULL,
  `output_pairs` int DEFAULT '0',
  `target_pairs` int DEFAULT '0',
  `target_mins` int DEFAULT '0',
  `start_time` time DEFAULT NULL,
  `finish_time` time DEFAULT NULL,
  `idle_stop_time` int DEFAULT '0',
  `idle_start_time` int DEFAULT '0',
  `actual_time` int DEFAULT '0',
  `button_status` tinyint DEFAULT '1' COMMENT '1=Start, 2=Finish, 3=Stop',
  `target_pairs_per_tray` int DEFAULT '0',
  `tray_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `stoppage_reason` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prod_date` (`prod_date`),
  KEY `idx_machine_id` (`machine_id`),
  KEY `idx_work_centre` (`work_centre_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prod_data`
--

LOCK TABLES `prod_data` WRITE;
/*!40000 ALTER TABLE `prod_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `prod_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_alerts`
--

DROP TABLE IF EXISTS `production_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alert_type` enum('efficiency_low','headcount_low','machine_idle','target_at_risk','custom') NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
  `work_centre_id` int DEFAULT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `alert_date` date NOT NULL,
  `message` text NOT NULL,
  `threshold_value` decimal(10,2) DEFAULT NULL,
  `actual_value` decimal(10,2) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `emailed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_alert_date` (`alert_date`),
  KEY `idx_unread` (`is_read`,`alert_date`),
  KEY `idx_wc` (`work_centre_id`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_alerts`
--

LOCK TABLES `production_alerts` WRITE;
/*!40000 ALTER TABLE `production_alerts` DISABLE KEYS */;
INSERT INTO `production_alerts` VALUES (1,'efficiency_low','critical',5,'01','2026-04-11','Machine 01 efficiency critically low at 42% (threshold: 50%)',50.00,42.00,1,'2026-04-11 15:05:34',0),(2,'efficiency_low','warning',5,'02','2026-04-11','Machine 02 efficiency below target at 65% (threshold: 70%)',70.00,65.00,1,'2026-04-11 15:05:34',0),(3,'headcount_low','warning',5,NULL,'2026-04-11','Work centre headcount low: 3 present vs 7 target (42%)',7.00,3.00,1,'2026-04-11 15:05:34',0),(4,'target_at_risk','critical',5,NULL,'2026-04-11','Daily target at risk: 48 / 200 pairs produced (24%)',200.00,48.00,1,'2026-04-11 15:05:34',0),(5,'target_at_risk','warning',5,NULL,'2026-04-11','Daily target at risk: 130 / 200 pairs produced (65%)',200.00,130.00,1,'2026-04-11 15:05:34',0),(8,'efficiency_low','warning',5,'TEST-01','2026-04-11','Machine TEST-01 efficiency below target at 50.0% (threshold: 70%)',70.00,50.00,1,'2026-04-11 15:32:35',0),(9,'headcount_low','warning',5,NULL,'2026-04-14','Work centre headcount low: 1 present vs 7 target (6%)',7.00,1.00,0,'2026-04-14 11:31:52',1),(10,'target_at_risk','critical',5,NULL,'2026-04-14','Daily target at risk: 72 / 420 pairs produced (17%)',420.00,72.00,0,'2026-04-14 11:31:52',1),(11,'efficiency_low','warning',1,'03','2026-04-14','Machine 03 efficiency below target at 62.5% (threshold: 70%)',70.00,62.50,0,'2026-04-14 12:45:08',1),(12,'efficiency_low','warning',7,'12','2026-04-14','Machine 12 efficiency below target at 62.5% (threshold: 70%)',70.00,62.50,0,'2026-04-14 13:19:56',1),(13,'efficiency_low','warning',7,'12','2026-04-14','Machine 12 efficiency below target at 62.5% (threshold: 70%)',70.00,62.50,0,'2026-04-14 13:29:40',1),(14,'headcount_low','warning',5,NULL,'2026-04-15','Work centre headcount low: 0 present vs 7 target (0%), 7 absent (108, 278, 346, 580, 709, ...)',7.00,NULL,0,'2026-04-15 10:00:11',0),(15,'headcount_low','warning',7,NULL,'2026-04-15','Work centre headcount low: 0 present vs 2 target (0%), 2 absent (EMP-1001, EMP-1002)',2.00,NULL,0,'2026-04-15 10:00:11',0),(16,'headcount_low','warning',5,NULL,'2026-04-15','Work centre headcount low: 2 present vs 7 target (29%), 5 absent (108, 278, 346, 580, 709)',7.00,2.00,0,'2026-04-15 15:07:27',0),(17,'headcount_low','warning',7,NULL,'2026-04-15','Work centre headcount low: 0 present vs 2 target (0%), 2 absent (EMP-1001, EMP-1002)',2.00,NULL,0,'2026-04-15 15:07:27',0),(18,'headcount_low','warning',5,NULL,'2026-04-15','Work centre headcount low: 2 present vs 7 target (29%), 5 absent (108, 278, 346, 580, 709)',7.00,2.00,0,'2026-04-15 16:07:27',0),(19,'headcount_low','warning',7,NULL,'2026-04-15','Work centre headcount low: 0 present vs 2 target (0%), 2 absent (EMP-1001, EMP-1002)',2.00,NULL,0,'2026-04-15 16:07:27',0),(20,'headcount_low','warning',5,NULL,'2026-04-15','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-15 17:00:59',0),(21,'target_at_risk','critical',5,NULL,'2026-04-15','Daily target at risk: 48 / 210 pairs produced (23%)',210.00,48.00,0,'2026-04-15 17:00:59',0),(22,'headcount_low','warning',5,NULL,'2026-04-15','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-15 17:07:56',0),(23,'target_at_risk','critical',5,NULL,'2026-04-15','Daily target at risk: 48 / 210 pairs produced (23%)',210.00,48.00,0,'2026-04-15 17:07:56',0),(24,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 10:02:02',0),(25,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 11:02:02',0),(26,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 15:00:50',0),(27,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 16:19:28',0),(28,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 18:45:22',0),(29,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 19:45:22',0),(30,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 20:45:22',0),(31,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 21:45:22',0),(32,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 22:45:22',0),(33,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-16 23:45:22',0),(34,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 00:45:22',0),(35,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 01:45:22',0),(36,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 02:45:22',0),(37,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 03:45:22',0),(38,'headcount_low','warning',5,NULL,'2026-04-16','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 04:45:22',0),(39,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 0 present vs 8 target (0%), 8 absent (108, 165, 278, 346, 580, ...)',8.00,NULL,0,'2026-04-17 05:45:22',0),(40,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 0 present vs 8 target (0%), 8 absent (108, 165, 278, 346, 580, ...)',8.00,NULL,0,'2026-04-17 06:45:22',0),(41,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 0 present vs 8 target (0%), 8 absent (108, 165, 278, 346, 580, ...)',8.00,NULL,0,'2026-04-17 07:45:22',0),(42,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 0 present vs 8 target (0%), 8 absent (108, 165, 278, 346, 580, ...)',8.00,NULL,0,'2026-04-17 08:45:22',0),(43,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 11:07:38',0),(44,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 12:07:37',0),(45,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 13:07:37',0),(46,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 14:07:37',0),(47,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 15:07:38',0),(48,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 16:07:39',0),(49,'headcount_low','warning',5,NULL,'2026-04-17','Work centre headcount low: 2 present vs 8 target (25%), 6 absent (108, 278, 346, 580, 709, ...)',8.00,2.00,0,'2026-04-17 17:07:37',0);
/*!40000 ALTER TABLE `production_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_day_locks`
--

DROP TABLE IF EXISTS `production_day_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_day_locks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lock_date` date NOT NULL,
  `work_centre_id` int NOT NULL,
  `locked_by` int NOT NULL,
  `locked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lock` (`lock_date`,`work_centre_id`),
  KEY `idx_lock_date` (`lock_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_day_locks`
--

LOCK TABLES `production_day_locks` WRITE;
/*!40000 ALTER TABLE `production_day_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_day_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_plan`
--

DROP TABLE IF EXISTS `production_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_plan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_date` date NOT NULL,
  `style_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `group_id` int NOT NULL,
  `leather_id` int NOT NULL,
  `color_id` int NOT NULL,
  `work_centre_id` int NOT NULL,
  `total_target_per_day` int NOT NULL,
  `target_pairs_per_tray` int NOT NULL,
  `tray_count` int DEFAULT NULL,
  `man_hours_minutes` int NOT NULL,
  `smv_per_pair` decimal(10,4) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_plan_date_work_centre` (`plan_date`,`work_centre_id`),
  KEY `style_id` (`style_id`),
  KEY `customer_id` (`customer_id`),
  KEY `group_id` (`group_id`),
  KEY `leather_id` (`leather_id`),
  KEY `color_id` (`color_id`),
  KEY `work_centre_id` (`work_centre_id`),
  CONSTRAINT `production_plan_ibfk_1` FOREIGN KEY (`style_id`) REFERENCES `styles` (`id`),
  CONSTRAINT `production_plan_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `production_plan_ibfk_3` FOREIGN KEY (`group_id`) REFERENCES `groups_master` (`id`),
  CONSTRAINT `production_plan_ibfk_4` FOREIGN KEY (`leather_id`) REFERENCES `leather` (`id`),
  CONSTRAINT `production_plan_ibfk_5` FOREIGN KEY (`color_id`) REFERENCES `colors` (`id`),
  CONSTRAINT `production_plan_ibfk_6` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
INSERT INTO `production_plan` VALUES (8,'2026-04-14',1,1,1,1,1,5,210,12,18,15,68.7800,'2026-04-14 06:58:01','2026-04-14 06:58:01'),(10,'2026-04-15',1,1,1,1,1,5,210,12,18,17,68.7800,'2026-04-15 08:39:44','2026-04-15 08:39:44'),(11,'2026-04-16',1,1,1,1,1,5,210,12,18,17,68.7800,'2026-04-15 11:20:24','2026-04-15 11:20:24'),(12,'2026-04-17',1,1,1,1,1,5,210,12,18,16,68.7800,'2026-04-16 12:10:36','2026-04-16 12:10:36');
/*!40000 ALTER TABLE `production_plan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_routing_header`
--

DROP TABLE IF EXISTS `production_routing_header`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_routing_header` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `group_id` int NOT NULL,
  `leather_id` int NOT NULL,
  `style_id` int NOT NULL,
  `color_id` int NOT NULL,
  `created_on` date NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `target_per_day` int NOT NULL,
  `target_per_hour` decimal(10,2) GENERATED ALWAYS AS ((`target_per_day` / 8)) STORED,
  `tot_smv` decimal(10,4) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_style_machine` (`style_id`),
  UNIQUE KEY `unique_style_date` (`style_id`,`created_on`),
  KEY `customer_id` (`customer_id`),
  KEY `group_id` (`group_id`),
  KEY `leather_id` (`leather_id`),
  KEY `style_id` (`style_id`),
  KEY `color_id` (`color_id`),
  CONSTRAINT `production_routing_header_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `production_routing_header_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups_master` (`id`),
  CONSTRAINT `production_routing_header_ibfk_3` FOREIGN KEY (`leather_id`) REFERENCES `leather` (`id`),
  CONSTRAINT `production_routing_header_ibfk_4` FOREIGN KEY (`style_id`) REFERENCES `styles` (`id`),
  CONSTRAINT `production_routing_header_ibfk_5` FOREIGN KEY (`color_id`) REFERENCES `colors` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_header`
--

LOCK TABLES `production_routing_header` WRITE;
/*!40000 ALTER TABLE `production_routing_header` DISABLE KEYS */;
INSERT INTO `production_routing_header` (`id`, `customer_id`, `group_id`, `leather_id`, `style_id`, `color_id`, `created_on`, `category`, `target_per_day`, `tot_smv`, `created_at`, `updated_at`) VALUES (25,1,1,1,1,1,'2026-04-05','Attaching',210,68.7800,'2026-04-09 06:55:07','2026-04-16 04:20:01');
/*!40000 ALTER TABLE `production_routing_header` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_routing_lines`
--

DROP TABLE IF EXISTS `production_routing_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_routing_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `routing_header_id` int NOT NULL,
  `machine_centre_id` varchar(100) NOT NULL,
  `process` varchar(100) DEFAULT NULL,
  `observed_time` decimal(10,2) NOT NULL,
  `rating_factor` decimal(5,2) NOT NULL,
  `normal_time_secs_pr` decimal(10,4) GENERATED ALWAYS AS (((`observed_time` * `rating_factor`) / 100)) STORED,
  `std_time_secs_pr` decimal(10,4) GENERATED ALWAYS AS ((((`observed_time` * `rating_factor`) / 100) * 1.15)) STORED,
  `mins_12_prs_box` decimal(10,4) GENERATED ALWAYS AS ((((((`observed_time` * `rating_factor`) / 100) * 1.15) * 12) / 60)) STORED,
  `manpower` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `routing_header_id` (`routing_header_id`),
  KEY `machine_centre_id` (`machine_centre_id`),
  CONSTRAINT `fk_routing_lines_machine` FOREIGN KEY (`machine_centre_id`) REFERENCES `machine_centres` (`machine_id`),
  CONSTRAINT `production_routing_lines_ibfk_1` FOREIGN KEY (`routing_header_id`) REFERENCES `production_routing_header` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_lines`
--

LOCK TABLES `production_routing_lines` WRITE;
/*!40000 ALTER TABLE `production_routing_lines` DISABLE KEYS */;
INSERT INTO `production_routing_lines` (`id`, `routing_header_id`, `machine_centre_id`, `process`, `observed_time`, `rating_factor`, `manpower`, `created_at`, `updated_at`) VALUES (85,25,'01','Eyelet Attaching',178.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(86,25,'02','Toe Attaching',150.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(87,25,'03','Heelgrip attaching + collar attaching',167.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(88,25,'04','Folding',160.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(89,25,'05','Final Stitching',60.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(90,25,'06','Counter Attaching',136.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01'),(91,25,'07','Eol Final Inspection',50.00,90.00,1.00,'2026-04-16 04:20:01','2026-04-16 04:20:01');
/*!40000 ALTER TABLE `production_routing_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rework_rejection`
--

DROP TABLE IF EXISTS `rework_rejection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rework_rejection` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `work_centre_id` int NOT NULL,
  `production_date` date NOT NULL,
  `machine_centre_name` varchar(100) DEFAULT NULL,
  `total_output_pairs` int DEFAULT '0',
  `bins_completed` int DEFAULT '0',
  `rework_qty` int DEFAULT '0',
  `rejection_qty` int DEFAULT '0',
  `reason_category` varchar(20) DEFAULT NULL,
  `reason` varchar(100) DEFAULT NULL,
  `saved_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wc_date` (`work_centre_id`,`production_date`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rework_rejection`
--

LOCK TABLES `rework_rejection` WRITE;
/*!40000 ALTER TABLE `rework_rejection` DISABLE KEYS */;
INSERT INTO `rework_rejection` VALUES (1,5,'2026-04-11','Attaching',12,1,1,4,'MACHINE','Needle/Foot','2026-04-11 12:58:49'),(2,5,'2026-04-11','Folding',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49'),(3,5,'2026-04-11','Stiching',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49'),(4,5,'2026-04-11','MIC Operator',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49'),(5,5,'2026-04-11','Latex Spraying',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49'),(6,5,'2026-04-11','Eyelet punching and clouching',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49'),(7,5,'2026-04-11','Trimming',12,1,0,0,NULL,NULL,'2026-04-11 12:58:49');
/*!40000 ALTER TABLE `rework_rejection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `default_route` varchar(255) NOT NULL,
  `allowed_menus` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Admin','/overview','[\"overview\", \"reports\", \"production_routing\", \"production_planning\", \"line_setup_form\", \"production_tracker\", \"mobile\", \"customers\", \"groups\", \"leather\", \"styles\", \"colors\", \"work_centres\", \"machine_centres\", \"employees\", \"users\", \"forms_master\", \"user_rights\", \"roles\"]','2026-03-09 10:31:47','2026-03-09 10:31:47'),(2,'Line Supervisor','/overview','[\"overview\", \"line_setup_form\", \"production_tracker\", \"mobile\", \"reports\"]','2026-03-09 10:31:47','2026-03-09 10:31:47'),(3,'Machine Centre User','/mobile','[\"mobile\"]','2026-03-09 10:31:47','2026-03-09 10:31:47'),(4,'IED','/overview','[\"overview\", \"production_routing\", \"production_tracker\", \"reports\"]','2026-03-09 10:31:47','2026-03-09 10:31:47'),(5,'Planner','/overview','[\"overview\", \"production_planning\", \"production_tracker\", \"reports\", \"customers\", \"groups\", \"leather\", \"styles\", \"colors\", \"work_centres\", \"machine_centres\", \"employees\"]','2026-03-09 10:31:47','2026-03-09 10:31:47'),(6,'Unit Head','/overview','[\"overview\", \"production_tracker\", \"reports\"]','2026-03-09 10:31:47','2026-03-09 10:31:47');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stitching_events`
--

DROP TABLE IF EXISTS `stitching_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stitching_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `machine_id` varchar(20) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `event_time` datetime NOT NULL,
  `source_file` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_machine_id` (`machine_id`),
  KEY `idx_event_time` (`event_time`),
  KEY `idx_machine_event_time` (`machine_id`,`event_time`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stitching_events`
--

LOCK TABLES `stitching_events` WRITE;
/*!40000 ALTER TABLE `stitching_events` DISABLE KEYS */;
INSERT INTO `stitching_events` VALUES (1,'MAC-001',1,'2024-12-19 08:00:00','today_sample.json','2026-04-07 05:20:07'),(2,'MAC-001',0,'2024-12-19 08:45:00','today_sample.json','2026-04-07 05:20:07'),(3,'MAC-001',1,'2024-12-19 09:00:00','today_sample.json','2026-04-07 05:20:07'),(4,'MAC-001',0,'2024-12-19 11:30:00','today_sample.json','2026-04-07 05:20:07'),(5,'MAC-001',1,'2024-12-19 12:30:00','today_sample.json','2026-04-07 05:20:07'),(6,'MAC-001',0,'2024-12-19 17:00:00','today_sample.json','2026-04-07 05:20:07'),(7,'MAC-002',1,'2024-12-19 08:15:00','today_sample.json','2026-04-07 05:20:07'),(8,'MAC-002',0,'2024-12-19 10:00:00','today_sample.json','2026-04-07 05:20:07'),(9,'MAC-002',1,'2024-12-19 10:30:00','today_sample.json','2026-04-07 05:20:07'),(10,'MAC-002',0,'2024-12-19 12:00:00','today_sample.json','2026-04-07 05:20:07'),(11,'MAC-002',1,'2024-12-19 13:00:00','today_sample.json','2026-04-07 05:20:07'),(12,'MAC-002',0,'2024-12-19 16:30:00','today_sample.json','2026-04-07 05:20:07'),(13,'MC10',1,'2024-12-19 08:30:00','today_sample.json','2026-04-07 05:20:07'),(14,'MC10',0,'2024-12-19 09:30:00','today_sample.json','2026-04-07 05:20:07'),(15,'MC10',1,'2024-12-19 11:00:00','today_sample.json','2026-04-07 05:20:07'),(16,'MC10',0,'2024-12-19 13:30:00','today_sample.json','2026-04-07 05:20:07'),(17,'MC10',1,'2024-12-19 14:30:00','today_sample.json','2026-04-07 05:20:07'),(18,'MC10',0,'2024-12-19 16:00:00','today_sample.json','2026-04-07 05:20:07'),(19,'MC11',1,'2024-12-19 08:00:00','today_sample.json','2026-04-07 05:20:07'),(20,'MC11',0,'2024-12-19 12:00:00','today_sample.json','2026-04-07 05:20:07'),(21,'MC11',1,'2024-12-19 13:00:00','today_sample.json','2026-04-07 05:20:07'),(22,'MC11',0,'2024-12-19 17:00:00','today_sample.json','2026-04-07 05:20:07'),(23,'MAC-001',1,'2026-04-07 08:00:00','today_sample.json','2026-04-07 05:24:37'),(24,'MAC-001',0,'2026-04-07 08:45:00','today_sample.json','2026-04-07 05:24:37'),(25,'MAC-001',1,'2026-04-07 09:00:00','today_sample.json','2026-04-07 05:24:37'),(26,'MAC-001',0,'2026-04-07 11:30:00','today_sample.json','2026-04-07 05:24:37'),(27,'MAC-001',1,'2026-04-07 12:30:00','today_sample.json','2026-04-07 05:24:37'),(28,'MAC-001',0,'2026-04-07 17:00:00','today_sample.json','2026-04-07 05:24:37');
/*!40000 ALTER TABLE `stitching_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `styles`
--

DROP TABLE IF EXISTS `styles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `styles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `styles`
--

LOCK TABLES `styles` WRITE;
/*!40000 ALTER TABLE `styles` DISABLE KEYS */;
INSERT INTO `styles` VALUES (1,'6024','6024','2026-03-09 10:57:28','2026-04-08 08:01:09');
/*!40000 ALTER TABLE `styles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_table`
--

DROP TABLE IF EXISTS `test_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_table` (
  `id` int DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `test_table`
--

LOCK TABLES `test_table` WRITE;
/*!40000 ALTER TABLE `test_table` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_table` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_rights`
--

DROP TABLE IF EXISTS `user_rights`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_rights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `form_id` int NOT NULL,
  `read_permission` tinyint(1) DEFAULT '0',
  `write_permission` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_form` (`user_id`,`form_id`),
  KEY `form_id` (`form_id`),
  CONSTRAINT `user_rights_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_rights_ibfk_2` FOREIGN KEY (`form_id`) REFERENCES `forms_master` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_rights`
--

LOCK TABLES `user_rights` WRITE;
/*!40000 ALTER TABLE `user_rights` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_rights` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'user',
  `work_centre_id` int DEFAULT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `machine_centre_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `work_centre_id` (`work_centre_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','Administrator','2b4cd62f4fea939340859804f7d03515:c08d0075137b9b617324e55fb88868a021dd508a0ae53e1c6180aee23d8db1c9af6a19d7699b07b5ea9c75336140518beb93f6f25da99793c1006f21ff9eb220','Admin',NULL,NULL,'2026-03-09 10:24:45','2026-04-17 11:22:11',NULL),(2,'user','Regular User','user123','Line Supervisor',NULL,NULL,'2026-03-09 10:25:52','2026-03-09 10:27:20',NULL),(3,'IED','IED','123','IED',NULL,NULL,'2026-03-09 10:43:04','2026-04-10 04:59:56',NULL),(4,'Planner','Planner','b75710889a781f6f80516265f70e7689:e857c44344231d85cf00eb83090f63b3a265dfa4062e77873f884004cadc2e3e05b72db75ef6463cb7f18f80706dc19d8584ef3e930d2d0733b64df646af2991','Planner',NULL,NULL,'2026-03-09 10:43:35','2026-04-14 11:14:53',NULL),(5,'EMP-1001','MC1','123','Machine Centre User',NULL,'MAC-001','2026-03-09 10:44:26','2026-04-10 05:00:51','Folding 1'),(6,'EMP-1002','MC2','123','Machine Centre User',NULL,'MAC-002','2026-03-09 10:44:48','2026-04-10 05:00:51','Elastic stitching 1'),(7,'Supervisor','Supervisor','6313e9d3fcc26de511ca9f807a302ff0:ee5ee122be447f55452a12691b4a409d2a2bb53a685b572c138272fc94f52303b1e58034307af47d7cf60ae87542f574fb84f6ef768598a161d76da71c3c2353','Line Supervisor',NULL,NULL,'2026-03-09 11:14:09','2026-04-14 04:51:01',NULL),(8,'Toe Attaching','Toe Attaching','12d1b0d9ad1a159da6513c9f441fb542:df43dc07630cfbae879668f476c979bdcfc155eaaf29ed0bf88b9101089abc07375c16a935c6a4451c1fb851634244660d6ce913d3278859f10fe082f3cd68ae','Machine Centre User',5,'02','2026-04-10 06:37:57','2026-04-14 05:05:29',NULL),(9,'Final Stitching','Final Stitching','5','Machine Centre User',5,'05','2026-04-10 06:39:58','2026-04-10 09:20:15',NULL),(10,'Heelgrip attaching + collar attaching','Heelgrip attaching + collar attaching','3','Machine Centre User',5,'03','2026-04-10 08:53:42','2026-04-14 05:28:52',NULL),(11,'Folding','Folding','4','Machine Centre User',5,'04','2026-04-10 08:54:33','2026-04-10 09:19:50',NULL),(12,'Counter Attaching','Counter Attaching','619ccd388da8bebce258d8c3ab25620d:9cdb9130223b7ff7d91f40d694e867230429019397df6e0c498f93e68922d2df282c4e1e2fb964af38f3ee9298730fa0324b574790af7b4b2acb22da32760cb7','Machine Centre User',5,'06','2026-04-10 08:55:07','2026-04-15 09:25:42',NULL),(13,'Eol Final Inspection','Eol Final Inspection','7','Machine Centre User',5,'07','2026-04-10 08:55:43','2026-04-10 09:21:08',NULL),(14,'724','P. Poornima','724','Machine Centre User',5,'06','2026-04-10 08:57:29','2026-04-10 08:57:29',NULL),(15,'Eyelet Attaching','Eyelet Attaching','f52b2f4777b62e8df32cc51549dc18e4:a470daa8dd173e733b600bb540c70e451a193d4c834d11f7dc9202c49738819bf0aa30c5ff11103107ddd48a7f673f99885b51e5e5b5a8e98d9928a1d2f9d570','Machine Centre User',5,'01','2026-04-10 09:14:15','2026-04-14 04:41:32',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_centres`
--

DROP TABLE IF EXISTS `work_centres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_centres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_centres`
--

LOCK TABLES `work_centres` WRITE;
/*!40000 ALTER TABLE `work_centres` DISABLE KEYS */;
INSERT INTO `work_centres` VALUES (5,'Stitching-line','Line 2A','2026-04-09 07:06:28','2026-04-11 06:01:19');
/*!40000 ALTER TABLE `work_centres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'florence'
--
/*!50003 DROP PROCEDURE IF EXISTS `ArchiveSummaryData` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`win-ebo7mqmm1pu` PROCEDURE `ArchiveSummaryData`()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    
    INSERT INTO machine_centre_summary_history 
    SELECT *, NOW() as archived_at 
    FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
    
    
    DELETE FROM machine_centre_summary 
    WHERE prod_date < CURDATE();
    
    COMMIT;
    
    SELECT CONCAT('Archived records older than today') as result;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-17 17:33:46

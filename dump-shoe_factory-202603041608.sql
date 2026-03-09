-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: 192.168.56.103    Database: shoe_factory
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
INSERT INTO `colors` VALUES (1,'YL1','YELLOW','2026-02-22 09:41:24','2026-02-22 09:41:24');
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
INSERT INTO `customers` VALUES (1,'ER1','ERAM','2026-02-22 09:40:12','2026-02-22 09:40:12');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'EMP-1001','ZAID',NULL,NULL,'2026-02-22 10:00:43','2026-02-23 20:19:28'),(2,'EMP-1002','IBRAHIM',NULL,NULL,'2026-03-02 09:18:44','2026-03-02 09:18:44');
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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forms_master`
--

LOCK TABLES `forms_master` WRITE;
/*!40000 ALTER TABLE `forms_master` DISABLE KEYS */;
INSERT INTO `forms_master` VALUES (1,'FRM001','Customer Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(2,'FRM002','Group Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(3,'FRM003','Leather Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(4,'FRM004','Style Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(5,'FRM005','Color Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(6,'FRM006','Work Centre Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(7,'FRM007','Machine Centre Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(8,'FRM008','Employee Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(9,'FRM009','TV Dashboard','2026-02-20 10:09:59','2026-02-20 10:09:59'),(10,'FRM010','Reports','2026-02-20 10:09:59','2026-02-20 10:09:59'),(11,'FRM011','Production Routing','2026-02-20 10:09:59','2026-02-20 10:09:59'),(12,'FRM012','Production Planning','2026-02-20 10:09:59','2026-02-20 10:09:59'),(13,'FRM013','Line Setup Form','2026-02-20 10:09:59','2026-02-20 10:09:59'),(14,'FRM014','Mobile Live Dashboard','2026-02-20 10:09:59','2026-02-20 10:09:59'),(15,'FRM015','Users','2026-02-20 10:09:59','2026-02-20 10:09:59'),(16,'FRM016','Forms Master','2026-02-20 10:09:59','2026-02-20 10:09:59'),(17,'FRM017','User Rights','2026-02-20 10:09:59','2026-02-20 10:09:59');
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
INSERT INTO `groups_master` VALUES (1,'BOCAGE','BOCAGE','2026-02-22 09:41:00','2026-02-22 09:41:00');
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
INSERT INTO `leather` VALUES (1,'CP1','Cow Palmar','2026-02-22 09:42:59','2026-02-22 09:42:59');
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Raw production entries - per 12 pairs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_production`
--

LOCK TABLES `machine_centre_production` WRITE;
/*!40000 ALTER TABLE `machine_centre_production` DISABLE KEYS */;
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
  `avg_efficiency_percent` decimal(6,2) GENERATED ALWAYS AS ((case when ((`total_actual_mins` + `total_idle_mins`) > 0) then ((`total_target_mins` / (`total_actual_mins` + `total_idle_mins`)) * 100) else 0 end)) STORED,
  `cum_avg_time` decimal(10,2) DEFAULT '0.00' COMMENT 'total_actual_mins / 12',
  `button_status` int DEFAULT '1' COMMENT 'Latest status (1/2/3)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_summary` (`prod_date`,`work_centre_id`,`machine_id`,`emp_id`),
  KEY `idx_summary_date` (`prod_date`),
  KEY `idx_summary_machine` (`machine_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Summary/Pivot table aggregated from machine_centre_production';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_summary`
--

LOCK TABLES `machine_centre_summary` WRITE;
/*!40000 ALTER TABLE `machine_centre_summary` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_centre_summary` ENABLE KEYS */;
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
  `machine_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `work_centre_id` (`work_centre_id`),
  CONSTRAINT `machine_centres_ibfk_1` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centres`
--

LOCK TABLES `machine_centres` WRITE;
/*!40000 ALTER TABLE `machine_centres` DISABLE KEYS */;
INSERT INTO `machine_centres` VALUES (2,1,'CLMC1','Front straps pasting for folding','MAC-001','2026-02-22 09:29:03','2026-03-02 10:24:10'),(3,3,'CLMC2','Front straps folding ','MAC-002','2026-02-22 09:29:50','2026-03-02 09:19:58');
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
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prod_data`
--

LOCK TABLES `prod_data` WRITE;
/*!40000 ALTER TABLE `prod_data` DISABLE KEYS */;
INSERT INTO `prod_data` VALUES (1,'2026-02-23',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-23 20:21:09','2026-02-23 20:21:09',NULL),(2,'2026-02-23',3,'MAC-001',1,0,0,10,'01:52:37','01:52:37',0,0,10,2,0,0,'2026-02-23 20:21:09','2026-02-23 20:22:37',NULL),(3,'2026-02-23',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-23 20:21:11','2026-02-23 20:21:11',NULL),(4,'2026-02-23',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-23 20:21:11','2026-02-23 20:21:11',NULL),(5,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:41:17','2026-02-24 09:41:17',NULL),(6,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:41:17','2026-02-24 09:41:17',NULL),(7,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:51:40','2026-02-24 09:51:40',NULL),(8,'2026-02-24',3,'MAC-001',1,0,0,10,'15:22:01',NULL,0,0,10,3,0,0,'2026-02-24 09:51:40','2026-02-24 09:52:06',NULL),(9,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:52:32','2026-02-24 09:52:32',NULL),(10,'2026-02-24',3,'MAC-001',1,0,0,10,'15:22:48','15:22:50',0,0,10,2,0,0,'2026-02-24 09:52:32','2026-02-24 09:52:50',NULL),(11,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:53:00','2026-02-24 09:53:00',NULL),(12,'2026-02-24',3,'MAC-001',1,4,0,10,'15:26:31','15:26:33',0,0,10,2,0,0,'2026-02-24 09:53:00','2026-02-24 09:56:33',NULL),(13,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:58:00','2026-02-24 09:58:00',NULL),(14,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 09:58:00','2026-02-24 09:58:00',NULL),(15,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:12:25','2026-02-24 10:12:25',NULL),(16,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:12:26','2026-02-24 10:12:26',NULL),(17,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:12:49','2026-02-24 10:12:49',NULL),(18,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:12:49','2026-02-24 10:12:49',NULL),(19,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:14:43','2026-02-24 10:14:43',NULL),(20,'2026-02-24',3,'MAC-001',1,0,0,10,NULL,NULL,0,0,10,1,0,0,'2026-02-24 10:14:43','2026-02-24 10:14:43',NULL),(21,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:22:13','2026-02-24 10:22:13',NULL),(22,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:22:13','2026-02-24 10:22:13',NULL),(23,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:23:58','2026-02-24 10:23:58',NULL),(24,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:23:58','2026-02-24 10:23:58',NULL),(25,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:25:53','2026-02-24 10:25:53',NULL),(26,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:25:53','2026-02-24 10:25:53',NULL),(27,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:32:06','2026-02-24 10:32:06',NULL),(28,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 10:32:06','2026-02-24 10:32:06',NULL),(29,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:01:07','2026-02-24 11:01:07',NULL),(30,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:01:07','2026-02-24 11:01:07',NULL),(31,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:01:12','2026-02-24 11:01:12',NULL),(32,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:01:13','2026-02-24 11:01:13',NULL),(33,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:06:42','2026-02-24 11:06:42',NULL),(34,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 11:06:42','2026-02-24 11:06:42',NULL),(35,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:30:51','2026-02-24 14:30:51',NULL),(36,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:30:52','2026-02-24 14:30:52',NULL),(37,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:31:08','2026-02-24 14:31:08',NULL),(38,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:31:09','2026-02-24 14:31:09',NULL),(39,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:31:42','2026-02-24 14:31:42',NULL),(40,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 14:31:44','2026-02-24 14:31:44',NULL),(41,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:14:00','2026-02-24 18:14:00',NULL),(42,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:14:00','2026-02-24 18:14:00',NULL),(43,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:15:49','2026-02-24 18:15:49',NULL),(44,'2026-02-24',3,'MAC-001',1,0,0,60,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:15:49','2026-02-24 18:15:49',NULL),(45,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:25:06','2026-02-24 18:25:06',NULL),(46,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:25:06','2026-02-24 18:25:06',NULL),(47,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:25:21','2026-02-24 18:25:21',NULL),(48,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:25:21','2026-02-24 18:25:21',NULL),(49,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:26:26','2026-02-24 18:26:26',NULL),(50,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:26:26','2026-02-24 18:26:26',NULL),(51,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:30:37','2026-02-24 18:30:37',NULL),(52,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:30:37','2026-02-24 18:30:37',NULL),(53,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:34:22','2026-02-24 18:34:22',NULL),(54,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:35:04','2026-02-24 18:35:04',NULL),(55,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:35:04','2026-02-24 18:35:04',NULL),(56,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:35:30','2026-02-24 18:35:30',NULL),(57,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:35:30','2026-02-24 18:35:30',NULL),(58,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:36:26','2026-02-24 18:36:26',NULL),(59,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:36:26','2026-02-24 18:36:26',NULL),(60,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:38:27','2026-02-24 18:38:27',NULL),(61,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:39:14','2026-02-24 18:39:14',NULL),(62,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:39:14','2026-02-24 18:39:14',NULL),(63,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:42:18','2026-02-24 18:42:18',NULL),(64,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:42:32','2026-02-24 18:42:32',NULL),(65,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:42:32','2026-02-24 18:42:32',NULL),(66,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:42:43','2026-02-24 18:42:43',NULL),(67,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:42:43','2026-02-24 18:42:43',NULL),(68,'2026-02-24',3,'MAC-001',1,72,0,17,'00:20:26','00:20:27',0,0,0,2,0,0,'2026-02-24 18:49:26','2026-02-24 18:50:27',NULL),(69,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:53:57','2026-02-24 18:53:57',NULL),(70,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:54:20','2026-02-24 18:54:20',NULL),(71,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:54:20','2026-02-24 18:54:20',NULL),(72,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:54:40','2026-02-24 18:54:40',NULL),(73,'2026-02-24',3,'MAC-001',1,36,0,17,'00:25:13','00:25:14',0,0,0,2,0,0,'2026-02-24 18:54:40','2026-02-24 18:55:14',NULL),(74,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 18:59:44','2026-02-24 18:59:44',NULL),(75,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:00:03','2026-02-24 19:00:03',NULL),(76,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:00:03','2026-02-24 19:00:03',NULL),(77,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:00:25','2026-02-24 19:00:25',NULL),(78,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:00:25','2026-02-24 19:00:25',NULL),(79,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:03:12','2026-02-24 19:03:12',NULL),(80,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:03:45','2026-02-24 19:03:45',NULL),(81,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:03:45','2026-02-24 19:03:45',NULL),(82,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:08:04','2026-02-24 19:08:04',NULL),(83,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:08:04','2026-02-24 19:08:04',NULL),(84,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:08:36','2026-02-24 19:08:36',NULL),(85,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:08:36','2026-02-24 19:08:36',NULL),(86,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:09:42','2026-02-24 19:09:42',NULL),(87,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:09:42','2026-02-24 19:09:42',NULL),(88,'2026-02-24',3,'MAC-001',1,0,0,17,'00:42:08',NULL,0,0,0,1,0,0,'2026-02-24 19:11:35','2026-02-24 19:12:08',NULL),(89,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:11:35','2026-02-24 19:11:35',NULL),(90,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:14:40','2026-02-24 19:14:40',NULL),(91,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:15:17','2026-02-24 19:15:17',NULL),(92,'2026-02-24',3,'MAC-001',1,0,0,17,'00:45:27',NULL,0,0,0,1,0,0,'2026-02-24 19:15:17','2026-02-24 19:15:27',NULL),(93,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:19:38','2026-02-24 19:19:38',NULL),(94,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:20:03','2026-02-24 19:20:03',NULL),(95,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:20:03','2026-02-24 19:20:03',NULL),(96,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:21:12','2026-02-24 19:21:12',NULL),(97,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:21:12','2026-02-24 19:21:12',NULL),(98,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:23:21','2026-02-24 19:23:21',NULL),(99,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:23:30','2026-02-24 19:23:30',NULL),(100,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:23:30','2026-02-24 19:23:30',NULL),(101,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:24:09','2026-02-24 19:24:09',NULL),(102,'2026-02-24',3,'MAC-001',1,0,0,17,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:24:09','2026-02-24 19:24:09',NULL),(103,'2026-02-24',3,'MAC-001',1,0,0,19,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:28:40','2026-02-24 19:28:40',NULL),(104,'2026-02-24',3,'MAC-001',1,0,0,21,NULL,NULL,0,0,0,3,0,0,'2026-02-24 19:29:24','2026-02-24 19:29:24',NULL),(105,'2026-02-24',3,'MAC-001',1,10,0,21,'01:01:06','01:00:21',0,0,0,3,0,0,'2026-02-24 19:29:24','2026-02-24 19:31:07',NULL);
/*!40000 ALTER TABLE `prod_data` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
INSERT INTO `production_plan` VALUES (1,'2026-03-03',1,1,1,1,1,3,3,13,4,8,40.7000,'2026-02-23 19:20:40','2026-03-02 18:42:14'),(2,'2026-03-03',1,1,1,1,1,1,8,14,11,6,14.0000,'2026-03-02 10:20:55','2026-03-03 10:19:55'),(3,'2026-03-03',1,1,1,1,1,2,8,14,14,8,14.0000,'2026-03-02 10:21:43','2026-03-02 18:40:46');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_header`
--

LOCK TABLES `production_routing_header` WRITE;
/*!40000 ALTER TABLE `production_routing_header` DISABLE KEYS */;
INSERT INTO `production_routing_header` (`id`, `customer_id`, `group_id`, `leather_id`, `style_id`, `color_id`, `created_on`, `category`, `target_per_day`, `tot_smv`, `created_at`, `updated_at`) VALUES (3,1,1,1,1,1,'2026-02-25','Test',14,14.0000,'2026-02-27 18:41:00','2026-02-28 10:13:15');
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
  `machine_centre_id` int NOT NULL,
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
  CONSTRAINT `production_routing_lines_ibfk_1` FOREIGN KEY (`routing_header_id`) REFERENCES `production_routing_header` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_routing_lines_ibfk_2` FOREIGN KEY (`machine_centre_id`) REFERENCES `machine_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_lines`
--

LOCK TABLES `production_routing_lines` WRITE;
/*!40000 ALTER TABLE `production_routing_lines` DISABLE KEYS */;
INSERT INTO `production_routing_lines` (`id`, `routing_header_id`, `machine_centre_id`, `observed_time`, `rating_factor`, `manpower`, `created_at`, `updated_at`) VALUES (3,3,2,92.00,4.00,3.00,'2026-02-28 10:13:15','2026-02-28 10:13:15');
/*!40000 ALTER TABLE `production_routing_lines` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stitching_events`
--

LOCK TABLES `stitching_events` WRITE;
/*!40000 ALTER TABLE `stitching_events` DISABLE KEYS */;
INSERT INTO `stitching_events` VALUES (1,'US-01',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(2,'US-01',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(3,'US-01',0,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(4,'US-02',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(5,'US-02',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(6,'US-03',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(7,'US-03',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(8,'US-03',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(9,'US-04',0,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(10,'US-04',1,'2026-02-21 21:21:37','todays-data.json','2026-02-21 15:51:37'),(11,'US-01',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(12,'US-01',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(13,'US-01',0,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(14,'US-02',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(15,'US-02',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(16,'US-03',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(17,'US-03',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(18,'US-03',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(19,'US-04',0,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(20,'US-04',1,'2026-02-22 06:07:16','todays-data.json','2026-02-22 00:37:16'),(21,'US-01',1,'2026-02-24 05:54:07','todays_test_data.json','2026-02-24 00:24:07'),(22,'US-02',0,'2026-02-24 05:54:07','todays_test_data.json','2026-02-24 00:24:07'),(23,'US-03',1,'2026-02-24 05:54:07','todays_test_data.json','2026-02-24 00:24:07'),(24,'US-04',1,'2026-02-24 05:54:07','todays_test_data.json','2026-02-24 00:24:07'),(25,'US-05',0,'2026-02-24 05:54:07','todays_test_data.json','2026-02-24 00:24:07'),(26,'US-01',1,'2026-02-25 21:09:58','todays_test_data.json','2026-02-25 15:39:58'),(27,'US-02',0,'2026-02-25 21:09:58','todays_test_data.json','2026-02-25 15:39:58'),(28,'US-03',1,'2026-02-25 21:09:58','todays_test_data.json','2026-02-25 15:39:58'),(29,'US-04',1,'2026-02-25 21:09:58','todays_test_data.json','2026-02-25 15:39:58'),(30,'US-05',0,'2026-02-25 21:09:58','todays_test_data.json','2026-02-25 15:39:58'),(31,'US-01',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(32,'US-01',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(33,'US-01',0,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(34,'US-02',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(35,'US-02',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(36,'US-03',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(37,'US-03',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(38,'US-03',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(39,'US-04',0,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(40,'US-04',1,'2026-02-25 21:09:58','todays-data.json','2026-02-25 15:39:58'),(41,'US-01',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(42,'US-01',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(43,'US-01',0,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(44,'US-02',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(45,'US-02',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(46,'US-03',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(47,'US-03',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(48,'US-03',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(49,'US-04',0,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49'),(50,'US-04',1,'2026-02-26 21:51:49','todays-data.json','2026-02-26 16:21:49');
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
INSERT INTO `styles` VALUES (1,'BATLIO1','BATLIO','2026-02-22 09:40:39','2026-02-22 09:40:39');
/*!40000 ALTER TABLE `styles` ENABLE KEYS */;
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
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'user',
  `work_centre_id` int DEFAULT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `email` (`email`),
  KEY `work_centre_id` (`work_centre_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`work_centre_id`) REFERENCES `work_centres` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (3,'user','Standard User','user@example.com','user123','Admin',1,'test','2026-02-21 11:04:48','2026-02-25 18:38:44'),(4,'ishtiyaque','ishtiyaque','ishtiyaqueahmeda@gmail.com','ishtiyaque123','IED',1,'test','2026-02-22 09:23:37','2026-02-25 18:47:22'),(5,'MC1','UCL1MC1','test@gmail.com','MC1123','Planner',3,'test','2026-02-22 09:33:35','2026-02-25 19:16:55'),(7,'MC2','UCL1MC2','test1@gmail.com','MC2123','Unit Head',3,'test','2026-02-22 09:34:15','2026-02-25 19:21:44'),(8,'test','Test','mnaqhid@gmail.com','test123','Line Supervisor',2,'test','2026-02-23 09:53:27','2026-02-25 18:29:25'),(16,'testing','Test','Testing@gmail.com','testing123','Machine Centre User',3,'Test','2026-02-23 19:43:35','2026-02-25 18:44:07');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_centres`
--

LOCK TABLES `work_centres` WRITE;
/*!40000 ALTER TABLE `work_centres` DISABLE KEYS */;
INSERT INTO `work_centres` VALUES (1,'WC001','Main Assembly Line','2026-02-21 11:04:36','2026-02-21 11:04:36'),(2,'UL1','Upper Line1','2026-02-22 09:24:40','2026-02-22 09:24:40'),(3,'UCL1','Upper Closing Line1','2026-02-22 09:27:58','2026-02-22 09:27:58');
/*!40000 ALTER TABLE `work_centres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'shoe_factory'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-04 16:08:16

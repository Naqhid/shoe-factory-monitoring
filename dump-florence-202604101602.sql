-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: florence
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'EMP-1001','Emp1',5,NULL,'2026-03-09 10:42:13','2026-04-10 06:24:14'),(2,'EMP-1002','Emp2',7,NULL,'2026-03-09 10:42:25','2026-04-10 06:26:34'),(3,'278','K. Suganthi',5,NULL,'2026-04-10 04:09:10','2026-04-10 06:24:15'),(4,'85','S. Juli',5,NULL,'2026-04-10 04:09:26','2026-04-10 06:24:15'),(5,'724','P. Poornima',5,NULL,'2026-04-10 04:09:40','2026-04-10 06:24:15'),(6,'108','P. Bharathi',5,NULL,'2026-04-10 04:09:57','2026-04-10 06:24:15'),(7,'346','K. Latha',5,NULL,'2026-04-10 04:10:14','2026-04-10 06:24:15'),(8,'580','G. Powlina',5,NULL,'2026-04-10 04:10:46','2026-04-10 06:24:15'),(9,'709','J. Devi',5,NULL,'2026-04-10 04:10:59','2026-04-10 06:24:15');
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
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Raw production entries - per 12 pairs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_production`
--

LOCK TABLES `machine_centre_production` WRITE;
/*!40000 ALTER TABLE `machine_centre_production` DISABLE KEYS */;
INSERT INTO `machine_centre_production` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `output_pairs`, `target_mins`, `start_time`, `finish_time`, `idle_start_time`, `idle_stop_time`, `button_status`, `created_at`, `updated_at`) VALUES (1,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:06:27','2026-03-23 15:06:52',NULL,NULL,2,'2026-03-23 09:36:27','2026-03-23 09:36:52'),(2,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:07:38','2026-03-23 15:07:53',NULL,NULL,2,'2026-03-23 09:37:38','2026-03-23 09:37:53'),(3,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:08:36','2026-03-23 15:09:29',NULL,NULL,2,'2026-03-23 09:38:36','2026-03-23 09:39:29'),(4,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:01','2026-03-23 15:24:08','2026-03-23 15:16:21','2026-03-23 15:24:01',2,'2026-03-23 09:46:08','2026-03-23 09:54:08'),(5,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:46','2026-03-23 15:24:53',NULL,NULL,2,'2026-03-23 09:54:46','2026-03-23 09:54:53'),(6,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:24:58','2026-03-23 15:25:05',NULL,NULL,2,'2026-03-23 09:54:58','2026-03-23 09:55:05'),(7,'2026-03-23',4,'MAC-001','EMP-1001',12,0.41,'2026-03-23 15:25:11','2026-03-23 15:25:13',NULL,NULL,2,'2026-03-23 09:55:11','2026-03-23 09:55:13'),(8,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 06:00:00','2026-04-07 06:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(9,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 06:30:00','2026-04-07 06:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(10,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 07:00:00','2026-04-07 07:20:00','2026-04-07 07:20:00','2026-04-07 07:35:00',2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(11,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 08:00:00','2026-04-07 08:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(12,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 09:00:00','2026-04-07 09:30:00','2026-04-07 09:30:00','2026-04-07 09:45:00',2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(13,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 10:00:00','2026-04-07 10:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(14,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 11:00:00','2026-04-07 11:20:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(15,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 12:00:00','2026-04-07 12:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(16,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 13:00:00','2026-04-07 13:30:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(17,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 06:15:00','2026-04-07 06:40:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(18,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 07:00:00','2026-04-07 07:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(19,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 08:30:00','2026-04-07 08:50:00','2026-04-07 08:00:00','2026-04-07 08:30:00',2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(20,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 09:15:00','2026-04-07 09:40:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(21,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 10:30:00','2026-04-07 10:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(22,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 11:30:00','2026-04-07 11:50:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(23,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 12:30:00','2026-04-07 12:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(24,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 13:15:00','2026-04-07 13:40:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(25,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 14:00:00','2026-04-07 14:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(26,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 15:00:00','2026-04-07 15:20:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(27,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 16:00:00','2026-04-07 16:30:00','2026-04-07 16:30:00','2026-04-07 16:45:00',2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(28,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 17:00:00','2026-04-07 17:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(29,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 18:00:00','2026-04-07 18:20:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(30,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 19:00:00','2026-04-07 19:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(31,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 20:00:00','2026-04-07 20:30:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(32,'2026-04-07',4,'MAC-001','EMP-1001',12,0.41,'2026-04-07 21:00:00','2026-04-07 21:25:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(33,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 14:30:00','2026-04-07 14:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(34,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 15:30:00','2026-04-07 15:50:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(35,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 16:45:00','2026-04-07 17:10:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(36,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 18:30:00','2026-04-07 18:50:00','2026-04-07 17:30:00','2026-04-07 18:30:00',2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(37,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 19:30:00','2026-04-07 19:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(38,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 20:30:00','2026-04-07 20:50:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(39,'2026-04-07',4,'MAC-002','EMP-1002',12,0.41,'2026-04-07 21:30:00','2026-04-07 21:55:00',NULL,NULL,2,'2026-04-07 05:45:58','2026-04-07 05:45:58'),(40,'2026-04-08',4,'MAC-001','EMP-1001',12,0.41,'2026-04-08 11:05:31','2026-04-08 11:05:40','2026-04-08 11:03:44','2026-04-08 11:05:31',2,'2026-04-08 05:33:38','2026-04-08 05:35:40'),(41,'2026-04-09',5,'01','EMP-1001',12,16.60,'2026-04-09 16:53:57','2026-04-09 16:54:09',NULL,NULL,2,'2026-04-09 11:23:57','2026-04-09 11:24:09'),(42,'2026-04-09',5,'01','EMP-1001',12,16.60,'2026-04-09 17:08:30','2026-04-09 17:08:39',NULL,NULL,2,'2026-04-09 11:38:30','2026-04-09 11:38:39'),(43,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 09:45:26','2026-04-10 09:45:49',NULL,NULL,2,'2026-04-10 04:15:26','2026-04-10 10:09:14'),(44,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 10:32:09','2026-04-10 10:32:17',NULL,NULL,2,'2026-04-10 05:02:09','2026-04-10 10:09:14'),(45,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 10:33:19','2026-04-10 10:33:22',NULL,NULL,2,'2026-04-10 05:03:19','2026-04-10 10:09:14'),(46,'2026-04-10',5,'01','108',12,141.80,'2026-04-10 11:15:26','2026-04-10 11:21:31',NULL,NULL,2,'2026-04-10 05:45:26','2026-04-10 05:51:31'),(47,'2026-04-10',5,'02','85',12,72.24,'2026-04-10 11:46:39','2026-04-10 11:46:51',NULL,NULL,2,'2026-04-10 06:16:39','2026-04-10 06:16:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Summary/Pivot table aggregated from machine_centre_production';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_summary`
--

LOCK TABLES `machine_centre_summary` WRITE;
/*!40000 ALTER TABLE `machine_centre_summary` DISABLE KEYS */;
INSERT INTO `machine_centre_summary` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `total_output_pairs`, `total_target_mins`, `total_actual_mins`, `total_idle_mins`, `cum_avg_time`, `button_status`, `created_at`, `updated_at`) VALUES (20,'2026-04-10',5,'01','108',48,567.20,6.64,0.00,0.00,2,'2026-04-10 04:15:49','2026-04-10 10:09:20'),(24,'2026-04-10',5,'02','85',12,72.24,0.20,0.00,0.00,2,'2026-04-10 06:16:51','2026-04-10 06:16:51');
/*!40000 ALTER TABLE `machine_centre_summary` ENABLE KEYS */;
UNLOCK TABLES;

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
INSERT INTO `machine_centre_summary_history` VALUES (8,'2026-04-07',4,'TEST-001','EMP-TEST',12,0.41,0.00,0.00,0.00,0.00,1,'2026-04-07 06:17:08','2026-04-07 06:17:08','2026-04-08 03:44:22'),(10,'2026-04-05',4,'MAC-001','EMP-1001',84,2.87,1.94,7.67,29.86,0.00,2,'2026-04-07 06:39:50','2026-04-07 06:39:50','2026-04-07 06:40:14'),(11,'2026-04-06',4,'MAC-002','EMP-1002',96,3.28,2.15,5.30,44.03,0.00,2,'2026-04-07 06:39:50','2026-04-07 06:39:50','2026-04-07 06:40:14'),(12,'2026-04-04',4,'MAC-001','EMP-1001',72,2.46,1.80,4.20,41.00,0.00,2,'2026-04-07 06:39:50','2026-04-07 06:39:50','2026-04-07 06:40:14'),(13,'2026-04-01',4,'MAC-001','EMP-1001',60,2.05,1.50,3.20,43.62,0.00,2,'2026-04-07 06:46:59','2026-04-07 06:46:59','2026-04-07 06:55:22'),(14,'2026-04-02',4,'MAC-002','EMP-1002',72,2.46,1.80,4.10,41.69,0.00,2,'2026-04-07 06:46:59','2026-04-07 06:46:59','2026-04-07 06:55:22'),(15,'2026-04-03',4,'MAC-001','EMP-1001',84,2.87,2.10,5.50,37.76,0.00,2,'2026-04-07 06:46:59','2026-04-07 06:46:59','2026-04-07 06:55:22'),(16,'2026-04-06',4,'MAC-002','EMP-1002',96,3.28,2.40,6.80,35.65,0.00,2,'2026-04-07 06:46:59','2026-04-07 06:46:59','2026-04-07 06:55:22'),(17,'2026-04-08',4,'MAC-001','EMP-1001',12,0.41,0.15,1.78,21.24,0.00,2,'2026-04-08 05:35:40','2026-04-08 05:35:40','2026-04-09 04:12:37'),(18,'2026-04-09',5,'01','EMP-1001',24,33.20,0.35,0.00,9485.71,0.00,2,'2026-04-09 11:24:09','2026-04-09 11:38:39','2026-04-10 04:00:07');
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
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centres`
--

LOCK TABLES `machine_centres` WRITE;
/*!40000 ALTER TABLE `machine_centres` DISABLE KEYS */;
INSERT INTO `machine_centres` VALUES (1,NULL,'09','Helper','Test','09','2026-03-09 10:39:27','2026-04-10 09:52:38'),(3,NULL,'MAC-002','Elastic stitching 1','Test','MAC-002','2026-03-09 11:19:12','2026-04-10 09:52:38'),(4,NULL,'MAC-001','Folding Test','Test','MAC-001','2026-03-09 11:28:02','2026-04-10 09:52:38'),(8,NULL,'10','Checking','Test','10','2026-03-23 05:34:44','2026-04-10 09:52:38'),(10,5,'05','Latex Spraying','Final Stitching','05','2026-04-08 03:55:33','2026-04-10 09:52:38'),(11,5,'06','Eyelet punching and clouching','Counter Attaching','06','2026-04-08 04:02:56','2026-04-10 09:52:38'),(12,5,'07','Trimming','Eol Final Inspection','07','2026-04-08 04:03:31','2026-04-10 09:52:38'),(13,5,'02','Folding','Toe Attaching','02','2026-04-08 04:04:35','2026-04-10 09:52:39'),(14,5,'03','Stiching','Hand stitching','03','2026-04-08 04:05:06','2026-04-10 09:52:39'),(15,NULL,'08','Auto Stitching','Test','08','2026-04-08 04:05:45','2026-04-10 09:52:55'),(18,5,'01','Attaching','Eyelet Attaching','01','2026-04-08 08:07:43','2026-04-10 09:52:39'),(19,5,'04','MIC Operator','Folding','04','2026-04-08 11:14:37','2026-04-10 09:52:39');
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
INSERT INTO `mobile_sessions` VALUES ('41da75f2-b9ca-4ce8-a41f-d1388a34ccb3','01','active',5,6,'108','2026-04-09 09:13:51','2026-04-10 04:14:45'),('eef3fb56-07aa-4003-ac61-2179f8d27a77','02','active',5,4,'85','2026-04-10 06:16:31','2026-04-10 06:16:31'),('fbd045ca-efb2-40ae-9d17-cbf334de6845','MAC-001','active',4,1,'EMP-1001','2026-03-23 09:35:36','2026-04-08 05:33:17');
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
INSERT INTO `production_plan` VALUES (6,'2026-04-10',1,1,1,1,1,5,210,12,18,3,68.7800,'2026-04-09 11:24:58','2026-04-10 04:26:07');
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
  `machine_centre_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_style_machine` (`style_id`,`machine_centre_id`),
  KEY `customer_id` (`customer_id`),
  KEY `group_id` (`group_id`),
  KEY `leather_id` (`leather_id`),
  KEY `style_id` (`style_id`),
  KEY `color_id` (`color_id`),
  KEY `fk_routing_machine_centre` (`machine_centre_id`),
  CONSTRAINT `fk_routing_machine_centre` FOREIGN KEY (`machine_centre_id`) REFERENCES `machine_centres` (`id`),
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
INSERT INTO `production_routing_header` (`id`, `customer_id`, `group_id`, `leather_id`, `style_id`, `color_id`, `created_on`, `category`, `target_per_day`, `tot_smv`, `created_at`, `updated_at`, `machine_centre_id`) VALUES (25,1,1,1,1,1,'2026-04-10','Attaching',210,68.7800,'2026-04-09 06:55:07','2026-04-10 04:18:43',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_lines`
--

LOCK TABLES `production_routing_lines` WRITE;
/*!40000 ALTER TABLE `production_routing_lines` DISABLE KEYS */;
INSERT INTO `production_routing_lines` (`id`, `routing_header_id`, `machine_centre_id`, `process`, `observed_time`, `rating_factor`, `manpower`, `created_at`, `updated_at`) VALUES (41,25,'01','I/o qtr lining + heelgrip pasting & attaching',49.00,90.00,0.50,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(42,25,'01','Qtr lining + collar fur lining attaching',118.00,90.00,0.50,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(43,25,'01','Vamp + eyelet stay + toe attaching',155.00,90.00,0.90,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(44,25,'01','Collar + collar tab attaching - jig',67.00,90.00,0.50,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(45,25,'01','Counter attaching - follow reverse side',136.00,90.00,1.00,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(46,25,'03','Collar seam stitching',127.00,90.00,1.00,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(47,25,'02','Collar folding & lining attaching',160.00,90.00,1.00,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(48,25,'02','Tongue + tongue lining preparation',189.00,90.00,1.50,'2026-04-10 10:16:53','2026-04-10 10:16:53'),(49,25,'01','Bottom all round attaching',160.00,90.00,1.00,'2026-04-10 10:16:53','2026-04-10 10:16:53');
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rework_rejection`
--

LOCK TABLES `rework_rejection` WRITE;
/*!40000 ALTER TABLE `rework_rejection` DISABLE KEYS */;
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
INSERT INTO `users` VALUES (1,'admin','Administrator','admin123','Admin',NULL,NULL,'2026-03-09 10:24:45','2026-03-09 10:27:20',NULL),(2,'user','Regular User','user123','Line Supervisor',NULL,NULL,'2026-03-09 10:25:52','2026-03-09 10:27:20',NULL),(3,'IED','IED','123','IED',NULL,NULL,'2026-03-09 10:43:04','2026-04-10 04:59:56',NULL),(4,'Planner','Planner','Planner123','Planner',NULL,NULL,'2026-03-09 10:43:35','2026-04-10 05:00:37',NULL),(5,'EMP-1001','MC1','123','Machine Centre User',NULL,'MAC-001','2026-03-09 10:44:26','2026-04-10 05:00:51','Folding 1'),(6,'EMP-1002','MC2','123','Machine Centre User',NULL,'MAC-002','2026-03-09 10:44:48','2026-04-10 05:00:51','Elastic stitching 1'),(7,'UCL1','Supervisor','123','Line Supervisor',NULL,NULL,'2026-03-09 11:14:09','2026-04-10 05:00:51',NULL),(8,'Toe Attaching','Toe Attaching','2','Machine Centre User',5,'02','2026-04-10 06:37:57','2026-04-10 09:17:35',NULL),(9,'Final Stitching','Final Stitching','5','Machine Centre User',5,'05','2026-04-10 06:39:58','2026-04-10 09:20:15',NULL),(10,'Hand stitching','Hand stitching','3','Machine Centre User',5,'03','2026-04-10 08:53:42','2026-04-10 09:18:02',NULL),(11,'Folding','Folding','4','Machine Centre User',5,'04','2026-04-10 08:54:33','2026-04-10 09:19:50',NULL),(12,'Counter Attaching','Counter Attaching','6','Machine Centre User',5,'06','2026-04-10 08:55:07','2026-04-10 09:20:41',NULL),(13,'Eol Final Inspection','Eol Final Inspection','7','Machine Centre User',5,'07','2026-04-10 08:55:43','2026-04-10 09:21:08',NULL),(14,'724','P. Poornima','724','Machine Centre User',5,'06','2026-04-10 08:57:29','2026-04-10 08:57:29',NULL),(15,'Eyelet Attaching','Eyelet Attaching','1','Machine Centre User',5,'01','2026-04-10 09:14:15','2026-04-10 09:14:15',NULL);
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
INSERT INTO `work_centres` VALUES (5,'Stitching-line','Line 2A - Humera','2026-04-09 07:06:28','2026-04-09 07:20:16'),(7,'Test-001','Test','2026-04-10 06:26:02','2026-04-10 06:26:02');
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

-- Dump completed on 2026-04-10 16:02:53

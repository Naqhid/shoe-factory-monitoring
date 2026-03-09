-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
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
INSERT INTO `colors` VALUES (1,'Grey','Grey','2026-03-09 10:57:44','2026-03-09 10:57:44');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'EMP-1001','Emp1',NULL,NULL,'2026-03-09 10:42:13','2026-03-09 10:42:13'),(2,'EMP-1002','Emp2',NULL,NULL,'2026-03-09 10:42:25','2026-03-09 10:42:25');
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
INSERT INTO `groups_master` VALUES (1,'GR1','Corstone','2026-03-09 11:04:30','2026-03-09 11:04:30');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Raw production entries - per 12 pairs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_production`
--

LOCK TABLES `machine_centre_production` WRITE;
/*!40000 ALTER TABLE `machine_centre_production` DISABLE KEYS */;
INSERT INTO `machine_centre_production` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `output_pairs`, `target_mins`, `start_time`, `finish_time`, `idle_start_time`, `idle_stop_time`, `button_status`, `created_at`, `updated_at`) VALUES (1,'2026-03-09',1,'MAC-002','EMP-1001',12,52.79,'2026-03-09 16:50:49','2026-03-09 16:55:29',NULL,NULL,2,'2026-03-09 11:20:49','2026-03-09 11:25:29'),(2,'2026-03-09',1,'MAC-002','EMP-1001',12,52.79,'2026-03-09 17:02:23','2026-03-09 17:02:36',NULL,NULL,2,'2026-03-09 11:32:23','2026-03-09 11:32:36');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Summary/Pivot table aggregated from machine_centre_production';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centre_summary`
--

LOCK TABLES `machine_centre_summary` WRITE;
/*!40000 ALTER TABLE `machine_centre_summary` DISABLE KEYS */;
INSERT INTO `machine_centre_summary` (`id`, `prod_date`, `work_centre_id`, `machine_id`, `emp_id`, `total_output_pairs`, `total_target_mins`, `total_actual_mins`, `total_idle_mins`, `cum_avg_time`, `button_status`, `created_at`, `updated_at`) VALUES (1,'2026-03-09',1,'MAC-002','EMP-1001',24,105.58,4.89,0.00,0.00,2,'2026-03-09 11:25:29','2026-03-09 11:32:36');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_centres`
--

LOCK TABLES `machine_centres` WRITE;
/*!40000 ALTER TABLE `machine_centres` DISABLE KEYS */;
INSERT INTO `machine_centres` VALUES (1,1,'MC1','Elastic Stitching','MC1','2026-03-09 10:39:27','2026-03-09 10:39:27'),(2,1,'MC2','Upper Top Line Stitching','MC2','2026-03-09 10:40:01','2026-03-09 10:40:01'),(3,1,'MAC-002','Elastic stitching','MAC-002','2026-03-09 11:19:12','2026-03-09 11:19:12'),(4,1,'MAC-001','MAC-001','MAC-001','2026-03-09 11:28:02','2026-03-09 11:28:02');
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
INSERT INTO `mobile_sessions` VALUES ('b34fbde9-d7e7-445b-b0bd-2a4599cec971','MAC-001','active',1,2,'EMP-1002','2026-03-09 11:28:10','2026-03-09 11:28:10'),('d67f6013-70a5-49ee-bf54-0109948d2a83','MAC-002','active',1,1,'EMP-1001','2026-03-09 11:20:21','2026-03-09 11:20:21');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
INSERT INTO `production_plan` VALUES (1,'2026-03-09',1,1,1,1,1,1,240,12,1,8,39.9700,'2026-03-09 11:07:20','2026-03-09 11:07:20');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_header`
--

LOCK TABLES `production_routing_header` WRITE;
/*!40000 ALTER TABLE `production_routing_header` DISABLE KEYS */;
INSERT INTO `production_routing_header` (`id`, `customer_id`, `group_id`, `leather_id`, `style_id`, `color_id`, `created_on`, `category`, `target_per_day`, `tot_smv`, `created_at`, `updated_at`) VALUES (1,1,1,1,1,1,'2026-03-09','Upper',240,39.9700,'2026-03-09 11:06:09','2026-03-09 11:06:09');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_routing_lines`
--

LOCK TABLES `production_routing_lines` WRITE;
/*!40000 ALTER TABLE `production_routing_lines` DISABLE KEYS */;
INSERT INTO `production_routing_lines` (`id`, `routing_header_id`, `machine_centre_id`, `observed_time`, `rating_factor`, `manpower`, `created_at`, `updated_at`) VALUES (1,1,1,105.00,90.00,1.00,'2026-03-09 11:06:09','2026-03-09 11:06:09'),(2,1,2,150.00,90.00,1.00,'2026-03-09 11:06:09','2026-03-09 11:06:09');
/*!40000 ALTER TABLE `production_routing_lines` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stitching_events`
--

LOCK TABLES `stitching_events` WRITE;
/*!40000 ALTER TABLE `stitching_events` DISABLE KEYS */;
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
INSERT INTO `styles` VALUES (1,'6025','6025','2026-03-09 10:57:28','2026-03-09 10:57:28');
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','Administrator','admin@florence.com','admin123','Admin',NULL,NULL,'2026-03-09 10:24:45','2026-03-09 10:27:20'),(2,'user','Regular User','user@florence.com','user123','Line Supervisor',NULL,NULL,'2026-03-09 10:25:52','2026-03-09 10:27:20'),(3,'IED','IED','test1@gmail.com','123','IED',2,NULL,'2026-03-09 10:43:04','2026-03-09 10:43:04'),(4,'Plan1','Planner','test2@gmail.com','123','Planner',3,NULL,'2026-03-09 10:43:35','2026-03-09 10:43:35'),(5,'MC1','MC1','test3@gmail.com','123','Machine Centre User',1,'MC1','2026-03-09 10:44:26','2026-03-09 10:44:26'),(6,'MC2','MC2','test4@gmail.com','123','Machine Centre User',1,'MC2','2026-03-09 10:44:48','2026-03-09 10:44:48'),(7,'UCL1','Supervisor','test5@gmail.com','123','Line Supervisor',1,NULL,'2026-03-09 11:14:09','2026-03-09 11:14:09');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_centres`
--

LOCK TABLES `work_centres` WRITE;
/*!40000 ALTER TABLE `work_centres` DISABLE KEYS */;
INSERT INTO `work_centres` VALUES (1,'UCL3','Upper Closing Line3','2026-03-09 10:37:33','2026-03-09 10:37:33'),(2,'IED1','IED','2026-03-09 10:37:46','2026-03-09 10:37:46'),(3,'Plan1','Planning','2026-03-09 10:37:58','2026-03-09 10:37:58');
/*!40000 ALTER TABLE `work_centres` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-09 17:16:21

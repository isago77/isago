--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `FCMToken`(
    `userId` CHAR(36) NOT NULL,
    `deviceId` VARCHAR(64) NOT NULL,
    `token` VARCHAR(512) UNIQUE,
    `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(`userId`, `deviceId`),
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);
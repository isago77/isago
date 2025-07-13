--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `Chat`(
    `id` CHAR(36) PRIMARY KEY,
    `senderId` CHAR(36),
    `targetId` CHAR(36),
    `message` TEXT NOT NULL,
    `isRead` BOOLEAN DEFAULT FALSE,
    `updatedAt` DATETIME,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(`senderId`) REFERENCES `User`(`id`),
    FOREIGN KEY(`targetId`) REFERENCES `User`(`id`),
    INDEX (`senderId`),
    INDEX (`targetId`),
    INDEX (`createdAt`)
);
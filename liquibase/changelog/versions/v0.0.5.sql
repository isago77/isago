--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `Settlement`(
    `id` CHAR(36) PRIMARY KEY,
    `userId` CHAR(36) NOT NULL,
    `amount` INT NOT NULL,
    `status` ENUM("pending", "completed", "failed") DEFAULT "pending",
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `cursor` BIGINT UNIQUE AUTO_INCREMENT,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:2
CREATE TABLE `Notification`(
    `id` CHAR(36) PRIMARY KEY,
    `userId` CHAR(36) NOT NULL,
    `type` VARCHAR(128) NOT NOT,
    `data` TEXT,
    `body` JOIN NOT NOT,
    `isRead` BOOLEAN DEFAULT FALSE,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `cursor` BIGINT UNIQUE AUTO_INCREMENT,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);
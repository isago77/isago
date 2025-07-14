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

--changeset ttangkong:2
CREATE TABLE `ActiveChat`(
    `userId` CHAR(36) NOT NULL,
    `otherId` CHAR(36) NOT NULL,
    `latestChatId` CHAR(36) NOT NULL,
    PRIMARY KEY(`userId`, `otherId`),
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`),
    FOREIGN KEY(`otherId`) REFERENCES `User`(`id`),
    FOREIGN KEY(`latestChatId`) REFERENCES `Chat`(`id`)
);
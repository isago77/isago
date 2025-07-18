--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `User`(
    `id` CHAR(36) PRIMARY KEY,
    `email` VARCHAR(320) UNIQUE,
    `displayName` VARCHAR(15) NOT NULL,
    `phoneNumber` JSON NOT NULL, -- E.164
    `password` CHAR(128), -- SHA-512
    `passwordSalt` CHAR(64), -- SHA-256
    `marketingAccepted` BOOLEAN NOT NULL,
    `profileUrl` VARCHAR(512),
    `role` ENUM("estimator", "mover", "admin"),
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `cursor` BIGINT UNIQUE AUTO_INCREMENT
);

--changeset ttangkong:2
CREATE TABLE `UserOAuth`(
    `userId` CHAR(36) PRIMARY KEY,
    `provider` ENUM('naver', 'kakao', 'apple') NOT NULL,
    `providerUserId` VARCHAR(128) NOT NULL UNIQUE,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:3
CREATE TABLE `UserDetails`(
    `userId` CHAR(36) PRIMARY KEY,
    `introduction` VARCHAR(1024),
    `bannerUrl` VARCHAR(512),
    `links` JSON NOT NULL DEFAULT '[]',
    `address` JSON,
    `contactAs` VARCHAR(15),
    `serviceAreas` JSON,
    `accountDetails` JSON,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);
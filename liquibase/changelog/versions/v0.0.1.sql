--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `User`(
    `id` CHAR(36) PRIMARY KEY,
    `email` VARCHAR(320) UNIQUE,
    `displayName` VARCHAR(15) NOT NULL,
    `phoneNumber` VARCHAR(11) NOT NULL,
    `password` CHAR(128), -- SHA-512
    `passwordSalt` CHAR(64), -- SHA-256
    `marketingAccepted` BOOLEAN NOT NULL,
    `profileUrl` VARCHAR(512)
);

--changeset ttangkong:2
CREATE TABLE `UserOAuth`(
    `userId` CHAR(36) PRIMARY KEY,
    `provider` ENUM('naver', 'kakao', 'apple') NOT NULL,
    `providerUserId` VARCHAR(128) NOT NULL UNIQUE,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);
-- Active: 1751290518359@@127.0.0.1@3306@isago

CREATE TABLE `User`(
    `id` CHAR(36) PRIMARY KEY,
    `email` VARCHAR(320) NOT NULL UNIQUE,
    `displayName` VARCHAR(15) NOT NULL,
    `phoneNumber` VARCHAR(11) NOT NULL,
    `password` CHAR(128), -- SHA-512
    `passwordSalt` CHAR(64), -- SHA-256
    `marketingAccepted` BOOLEAN NOT NULL,
    `profileUrl` VARCHAR(512)
);
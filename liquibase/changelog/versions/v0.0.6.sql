--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `BusinessReview` (
    `id` CHAR(36) PRIMARY KEY,
    `userId` CHAR(36) NOT NULL,
    `desiredRole` ENUM("estimator", "mover"),
    `imageUrls` JSON NOT NULL DEFAULT '[]',
    `businessNumber` CHAR(10) NOT NULL,             -- 사업자 번호 (10자리 고정)
    `businessEndedAt` DATE,                         -- 사업자 등록 종료일
    `businessStatus` VARCHAR(16) NOT NULL,          -- 사업자 상태명 (e.g. 계속사업자)
    `businessStatusCode` VARCHAR(4) NOT NULL,       -- 사업자 상태 코드 (e.g. 01)
    `taxType` VARCHAR(32) NOT NULL,                 -- 과세 유형명 (e.g. 부가가치세 일반과세자)
    `taxTypeCode` VARCHAR(4) NOT NULL,              -- 과세 유형 코드
    `taxTypeChangedAt` DATE,                        -- 과세 유형이 변경된 날짜
    `isSummaryTaxPayer` BOOLEAN NOT NULL,           -- 간이과세자 여부 (TRUE: 간이과세자, FALSE: 일반과세자)
    `prevTaxType` VARCHAR(32) NOT NULL,             -- 수정 되기 전, 과거 과세 유형명
    `prevTaxTypeCode` VARCHAR(4) NOT NULL,          -- 수정 되기 전, 과거 과세 유형 코드
    `status` ENUM(
        "pending",
        "accepted",
        "rejected"
    ) DEFAULT "pending",
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `cursor` BIGINT UNIQUE AUTO_INCREMENT,
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:2
ALTER TABLE `BusinessReview` ADD COLUMN `reason` TEXT;
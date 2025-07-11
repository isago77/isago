--liquibase formatted sql

--changeset ttangkong:1
CREATE TABLE `Stage`(
    `id` CHAR(36) PRIMARY KEY,
    `userId` CHAR(36) NOT NULL,
    `fromAddress` JSON NOT NULL,
    `toAddress` JSON NOT NULL,
    `status` ENUM(
        'waitingEstimator',     -- 견적 방문자 할당 대기
        'estimatorAssigned',    -- 견적 방문자 할당 됨
        'estimateCompleted',    -- 견적 완료
        'waitingMover',         -- 이사 업체 제안/수락 대기
        'requestAccepted',      -- 특정 업체의 제안을 수락함 + 결제 완료
        'completed',            -- 이사 완료
        'cancelled'             -- 이사 최소
    ) NOT NULL,
    `preferredDate` DATETIME,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `endedAt` DATETIME,
    FOREIGN KEY(`userId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:2
CREATE TABLE `EstimatorStage`(
    `id` CHAR(36) PRIMARY KEY,
    `stageId` CHAR(36) NOT NULL,
    `estimatorId` CHAR(36) NOT NULL,
    `visitDate` DATE,
    `location` JSON,
    `details` JSON,
    `status` ENUM(
        'waiting',  -- 준비 또는 대기 중
        'visiting', -- 목표 집으로 이동 중
        'visited',  -- 방문하여 견적 중
        'completed' -- 견적 완료
    ) NOT NULL,
    FOREIGN KEY(`stageId`) REFERENCES `Stage`(`id`),
    FOREIGN KEY(`estimatorId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:3
CREATE TABLE `MoverRequest`(
    `id` CHAR(36) PRIMARY KEY,
    `stageId` CHAR(36) NOT NULL,
    `moverId` CHAR(36) NOT NULL,
    `proposedPrice` INT NOT NULL,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(`stageId`) REFERENCES `Stage`(`id`),
    FOREIGN KEY(`moverId`) REFERENCES `User`(`id`)
);

--changeset ttangkong:4
CREATE TABLE `MoverStage`(
    `id` CHAR(36) PRIMARY KEY,
    `stageId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL UNIQUE,
    `visitDate` DATE,
    `visitTime` TIME,
    `location` JSON,
    `status` ENUM(
        'waiting',  -- 준비 또는 대기 중
        'visiting', -- 목표 집으로 이동 중
        'working',  -- 이사 작업하는 중
        'finished', -- 작업자가 이사 작업 완료 표시
        'completed' -- 사용자가 이사 작업 완료 표시
    ) NOT NULL,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(`stageId`) REFERENCES `Stage`(`id`),
    FOREIGN KEY(`requestId`) REFERENCES `MoverRequest`(`id`)
);

--changeset ttangkong:5
CREATE TABLE `MoverReview`(
    `id` CHAR(36) PRIMARY KEY,
    `writerId` CHAR(36) NOT NULL,
    `moverStageId` CHAR(36) NOT NULL,
    `rating` TINYINT NOT NULL,
    `comment` VARCHAR(1024),
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(`writerId`, `moverStageId`),
    FOREIGN KEY(`writerId`) REFERENCES `User`(`id`),
    FOREIGN KEY(`moverStageId`) REFERENCES `MoverStage`(`id`)
);

--changeset ttangkong:6
CREATE TABLE `EstimatorAvailability`(
    id CHAR(36) PRIMARY KEY,
    estimatorId CHAR(36) NOT NULL,
    date DATE,
    count INT,
    FOREIGN KEY(`estimatorId`) REFERENCES `User`(`id`)
);
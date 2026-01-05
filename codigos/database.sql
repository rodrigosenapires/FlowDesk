CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(120) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verification_token` VARCHAR(64) DEFAULT NULL,
  `email_verification_expires_at` DATETIME DEFAULT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'principal',
  `owner_user_id` INT UNSIGNED DEFAULT NULL,
  `access_blocked` TINYINT(1) NOT NULL DEFAULT 0,
  `access_pending` TINYINT(1) NOT NULL DEFAULT 0,
  `password_reset_token` VARCHAR(64) DEFAULT NULL,
  `password_reset_expires_at` DATETIME DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_owner_user_id_idx` (`owner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_storage` (
  `user_id` INT UNSIGNED NOT NULL,
  `storage_key` VARCHAR(64) NOT NULL,
  `storage_value` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `storage_key`),
  CONSTRAINT `fk_user_storage_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

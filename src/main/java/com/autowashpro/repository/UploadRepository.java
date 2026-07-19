package com.autowashpro.repository;

import com.autowashpro.entity.Upload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UploadRepository extends JpaRepository<Upload, Long> {
    Optional<Upload> findByPublicId(String publicId);

    Optional<Upload> findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
            Long ownerId,
            String entityType,
            Long entityId);

    List<Upload> findByOwnerIdInAndEntityTypeOrderByCreatedAtDesc(
            List<Long> ownerIds,
            String entityType);
}

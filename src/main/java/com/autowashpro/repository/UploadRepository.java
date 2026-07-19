package com.autowashpro.repository;

import com.autowashpro.entity.Upload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UploadRepository extends JpaRepository<Upload, Long> {
    Optional<Upload> findByPublicId(String publicId);

    Optional<Upload> findFirstByOwnerIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
            Long ownerId,
            String entityType,
            Long entityId);

    @Query("""
        SELECT u FROM Upload u
        WHERE u.entityType = 'AVATAR'
          AND u.ownerId IN :ownerIds
        ORDER BY u.id DESC
        """)
    List<Upload> findAvatarsByOwnerIds(@Param("ownerIds") List<Long> ownerIds);
}

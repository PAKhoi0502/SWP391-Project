package com.autowashpro;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class AutowashproApplicationTests {

	@Autowired
	private DataSource dataSource;

	@Value("${waitlist.scheduler.enabled}")
	private boolean schedulerEnabled;

	@Value("${app.mail.enabled}")
	private boolean mailEnabled;

	@Test
	void contextLoadsWithIsolatedTestInfrastructure() throws SQLException {
		String databaseUrl;
		try (Connection connection = dataSource.getConnection()) {
			databaseUrl = connection.getMetaData().getURL();
		}

		assertTrue(databaseUrl.startsWith("jdbc:h2:mem:"));
		assertFalse(schedulerEnabled);
		assertFalse(mailEnabled);
	}

}

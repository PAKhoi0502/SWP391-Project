package com.autowashpro;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class AutowashproApplication {

	public static void main(String[] args) {
		SpringApplication.run(AutowashproApplication.class, args);
	}

}

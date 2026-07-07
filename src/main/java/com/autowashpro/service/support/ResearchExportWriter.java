package com.autowashpro.service.support;

import com.autowashpro.common.ResearchExportFormat;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SequenceWriter;
import com.fasterxml.jackson.dataformat.csv.CsvMapper;
import com.fasterxml.jackson.dataformat.csv.CsvSchema;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
public class ResearchExportWriter {

    private final ObjectMapper objectMapper;
    private final CsvMapper csvMapper;

    public ResearchExportWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.csvMapper = new CsvMapper();
        this.csvMapper.findAndRegisterModules();
    }

    public <T> byte[] write(List<T> rows, Class<T> rowType, ResearchExportFormat format) {
        try {
            if (format == ResearchExportFormat.JSON) {
                return objectMapper.writerFor(
                                objectMapper.getTypeFactory().constructCollectionType(List.class, rowType))
                        .writeValueAsBytes(rows);
            }
            return writeCsv(rows, rowType);
        } catch (JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate research export");
        }
    }

    private <T> byte[] writeCsv(List<T> rows, Class<T> rowType) {
        CsvSchema schema = csvMapper.schemaFor(rowType)
                .withHeader()
                .withLineSeparator("\r\n");
        if (rows.isEmpty()) {
            String header = IntStream.range(0, schema.size())
                    .mapToObj(index -> schema.column(index).getName())
                    .collect(Collectors.joining(","));
            return (header + "\r\n").getBytes(StandardCharsets.UTF_8);
        }
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             SequenceWriter writer = csvMapper.writerFor(rowType).with(schema).writeValues(output)) {
            writer.writeAll(rows);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate research export");
        }
    }
}

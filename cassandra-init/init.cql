CREATE KEYSPACE IF NOT EXISTS todo_ops WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE todo_ops;

CREATE TABLE IF NOT EXISTS todo_description_ops (
    todo_uuid text,
    revision_number bigint,
    op_id uuid,
    user_id int,
    operation_type text,
    position int,
    text_inserted text,
    length_deleted int,
    timestamp timestamp,
    PRIMARY KEY ((todo_uuid), revision_number, timestamp, op_id)
) WITH CLUSTERING ORDER BY (revision_number ASC, timestamp ASC, op_id ASC);

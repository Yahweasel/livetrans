#!/bin/sh
rm -f /tmp/livetrans.fifo ; mkfifo /tmp/livetrans.fifo
(
    while true
    do
        cat /tmp/livetrans.fifo
    done
) | ./livetrans.js

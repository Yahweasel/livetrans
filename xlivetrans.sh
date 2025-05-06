#!/bin/sh
# A small script to run live translation in a Sakura window
exec env GDK_SCALE=1 sakura -f 'Unifont Bold 32' -c 44 -r 16 -e env COLUMNS=44 ./livetrans.sh

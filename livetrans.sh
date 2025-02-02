#!/bin/sh
# Copyright (c) 2023-2025 Yahweasel
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
# SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
# OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
# CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

# This is a wrapper to perform live translation mediated by a FIFO,
# /tmp/livetrans.fifo . Send commands to this fifo directly, or with cmd.sh.

# Set up the window
/usr/bin/printf '\x1b[m\x1b[97m\x1b]2;Live Translation\x07\x1b[?25l'
WINID="$(xdotool selectwindow)"
rm -f /tmp/livetrans.fifo ; mkfifo /tmp/livetrans.fifo

# Process raw input $1 into OCR-able output $2. By default, this just moves $1
# to $2, but some comments are left here for processing steps I've found to be
# useful. separate-lines is a simple tool that separates abutting lines, which
# is useful if the location of text lines is predictable, but there's no space
# between them. The given ffmpeg line is to upscale using hqx, if your input is
# upscaled raw.
process() {
    #./separate-lines.js "$1" in1.png
    #ffmpeg -i in1.png -vf scale=-1:ih/3,hqx -y "$2"
    mv "$1" "$2"
}

# Read commands from the FIFO
(
    while true
    do
        cat /tmp/livetrans.fifo
    done
) |
while true
do
    read cmd
    clear
    printf '...\r'

    # COMMANDS:
    # o: OCR an input image. Reads the input image using scrot, so that the user
    #    can select the area they wish to OCR.
    # t, b: OCR part of the window selected with xdotool above. Theoretically
    #       these mean "top" and "bottom", but any actual cropping needs to be
    #       added below.
    # T: Translate whatever has been captured by OCR.
    # c: Clear the screen and any buffered OCR input.

    if [ "$cmd" = "t" -o "$cmd" = "b" ]
    then
        import -window "$WINID" raw.png
        process raw.png inraw.png
    fi

    if [ "$cmd" = "o" ]
    then
        rm -f raw.png
        scrot -fs raw.png
        process raw.png in.png
        ./ocr.js 2> /dev/null

    elif [ "$cmd" = "t" ]
    then
        #convert inraw.png -crop 482x114+140+102 in.png
        mv inraw.png in.png
        ./ocr.js 2> /dev/null

    elif [ "$cmd" = "b" ]
    then
        #convert inraw.png -crop 482x114+140+588 in.png
        mv inraw.png in.png
        ./ocr.js 2> /dev/null

    elif [ "$cmd" = "T" -a -e ocr.txt ]
    then
        ./livetrans.js 2> /dev/null && rm -f ocr.txt

    elif [ "$cmd" = "c" ]
    then
        clear
        rm -f ocr.txt

    else
        clear
    fi
done

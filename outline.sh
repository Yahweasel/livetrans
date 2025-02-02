#!/bin/sh
# A very simple script to turn a live translation window into a V4L2 device with
# a greenscreen background and small outline around the text.
while true
do
    WINID="$(xdotool search --name 'Live Translation')"
    ffmpeg -f x11grab -window_id "$WINID" -framerate 10 -i :0 \
        -filter_complex '
        [0:v]pad=w=960:h=720:x=(960-iw)/2:y=(720-ih)/2,split[vid][bg];
        [bg]colorize=120:1:0.5:0[bg];
        [vid]colorkey=black,split[vid][outline];
        [outline]dilation,dilation,dilation,dilation,dilation,dilation,dilation,dilation,negate[outline];
        [bg][outline]overlay[bg];
        [bg][vid]overlay[vid]' \
        -map '[vid]' -pix_fmt yuv420p -f v4l2 /dev/video1
    sleep 1
done

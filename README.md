# Live translation scripts

This is the scripts that Yahweasel uses to perform live translation during
streams. They're committed here for posterity, but really only intended for
Yahweasel's own use, so apply common sense if you intend to use them yourself.

The basic mode of operation of these scripts is:

1. The xlivetrans.sh script runs livetrans.sh in an X11 window, for ease of
   capture. outline.sh puts that in a V4L2 device with greenscreen.

2. livetrans.sh takes commands from a FIFO (`/tmp/livetrans.fifo`), and invokes
   either the OCR or translation tools. It is also responsible for performing
   the actual screen capture, though it just uses standard tools for that
   purpose.

3. ocr.js reads `in.png` and passes it to a vision API (either OpenAI or Google
   Vision) for OCR. It appends the result to `ocr.txt`.

4. livetrans.js reads `ocr.txt` and passes it *both* to OpenAI and to Google
   Translate for translation, then outputs the result. For OpenAI, it stores its
   chat history to `chat.json`, which allows its translations to be nuanced with
   the context of past translations.

ocr.js and livetrans.js should be generic enough that they can be used on any
system. livetrans.sh, xlivetrans.sh, and outline.sh are Linux- and X11-specific.

Configuration is in `config.json`. See `config.json.example` for what to put
there. Things like screen cropping are not configured, but injected manually
into livetrans.sh for each live translation.

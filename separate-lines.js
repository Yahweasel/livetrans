#!/usr/bin/env node
/*
 * Copyright (c) 2023-2025 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/* This is a small script to separate lines in an image, for input where the
 * lines of text abut each other, which can confuse OCR. */

const sc = require("stream/consumers");

const sharp = require("sharp");

async function main() {
    const inpS = sharp(await sc.buffer(process.stdin));
    const meta = await inpS.metadata();
    const w = meta.width / 3;
    const h = meta.height / 3;
    const inpBuf = await inpS.resize(w, h, {kernel: "nearest"}).toFormat("raw").toBuffer();

    const ho = h + h / 8;
    const outBuf = Buffer.alloc(w * ho * 3);

    let yo = 0;
    for (let yi = 0; yi < h; yi++) {
        outBuf.set(inpBuf.subarray(
            yi * w * 3, yi * w * 3 + w * 3
        ), yo * w * 3);
        yo++;

        if (yi % 16 === 15) {
            // Insert two grey rows
            for (let x = 0; x < w * 6; x++)
                outBuf[yo * w * 3 + x] = 0x80;
            yo += 2;
        }
    }

    await sharp(outBuf, {raw: {width: w, height: ho, channels: 3}}).png().pipe(process.stdout);
}
main();

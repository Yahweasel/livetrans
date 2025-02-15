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

// This is a wrapper to perform live translation with commands given to stdin.

const cproc = require("child_process");
const fs = require("fs/promises");
const rl = require("readline/promises");

const clear = "\x1b[H\x1b[2J\x1b[3J";

// Set up the window
process.stdout.write("\x1b[m\x1b[97m\x1b]2;Live Translation\x07\x1b[?25l" + clear);

// Generic program runner
async function run(cmd, args, opts = {}) {
    const p = cproc.spawn(cmd, args, {
        stdio: [
            opts.stdin ? "pipe" : "ignore",
            opts.stdout ? "pipe" : "inherit",
            "ignore"
        ]
    });
    if (opts.stdin)
        p.stdin.end(opts.stdin);

    const exitP = new Promise(res => p.on("exit", res));

    let ret;
    if (opts.stdout) {
        ret = [];
        p.stdout.on("data", chunk => ret.push(chunk));
        ret = await new Promise(res => {
            p.stdout.on("end", () => {
                res(Buffer.concat(ret));
            });
        });
    }

    await exitP;
    return ret;
}

let procQueue = Promise.all([]);
let queueLen = 0;

// Run this function in the queue
function enqueue(cmd, args, opts) {
    queueLen++;

    process.stdout.write(clear + "...");
    if (queueLen > 1)
        process.stdout.write(` (${queueLen})`);

    procQueue = procQueue.catch(()=>{}).then(async () => {
        let stdout;
        try {
            stdout = await run(cmd, args, opts);
        } catch (ex) {}

        if (--queueLen <= 0) {
            process.stdout.write(clear);
            if (stdout)
                process.stdout.write(stdout);
        } else {
            process.stdout.write(clear + "...");
            if (queueLen > 1)
                process.stdout.write(` (${queueLen})`);
        }
    });

    return procQueue;
}

/* Process raw input into OCR-able output. By default, just moves inp to outp,
 * but some comments are left here for processing steps I've found to be useful.
 * separate-lines is a simple tool that separates abutting lines, which is
 * useful if the location of text lines is predictable, but there's no space
 * between them. The given ffmpeg line is to upscale using hqx, if your input is
 * upscaled raw. */
async function imgProcess(inp) {
    let outp = inp;
    //outp = await run("./separate-lines.js", [], {stdin: outp, stdout: true});
    //outp = await run("ffmpeg", ["-i", "-", "-vf", "scale=-1:ih/3,hqx", "-f", "image2pipe", "-c:v", "png", "-"], {stdin: outp, stdout: true});
    return outp;
}

async function main() {
    const winID = (await run("xdotool", ["selectwindow"], {stdout: true})).toString("utf8").trim();

    const stdin = rl.createInterface({
        input: process.stdin,
        crlfDelay: 1/0
    });

    for await (let cmd of stdin) {
        cmd = cmd.trim();

        let img;
        if (cmd === "t" || cmd === "b") {
            img = await run("import", ["-window", winID, "png:-"], {stdout: true});
            img = await imgProcess(img);
        }

        /*
         * COMMANDS:
         * o: OCR an input image. Reads the input image using scrot, so that the user
         *    can select the area they wish to OCR.
         * t, b: OCR part of the window selected with xdotool above. Theoretically
         *       these mean "top" and "bottom", but any actual cropping needs to be
         *       added below.
         * T: Translate whatever has been captured by OCR.
         * c: Clear the screen and any buffered OCR input.
         */
        switch (cmd) {
            case "o":
                img = await run("scrot", ["-fs", "-"], {stdout: true});
                img = await imgProcess(img);
                enqueue("./ocr.js", [], {stdin: img, stdout: true});
                break;

            case "t":
                //img = await run("convert", ["-", "-crop", "100x100+100+100", "png:-"], {stdin: img, stdout: true});
                enqueue("./ocr.js", [], {stdin: img, stdout: true});
                break;

            case "b":
                //img = await run("convert", ["-", "-crop", "100x100+100+100", "png:-"], {stdin: img, stdout: true});
                enqueue("./ocr.js", [], {stdin: img, stdout: true});
                break;

            case "T":
                try {
                    await fs.access("ocr.txt");
                    (async function() {
                        try {
                            await enqueue("./trans.js", [], {stdout: true});
                            await fs.unlink("ocr.txt");
                        } catch (ex) {}
                    })();
                } catch (ex) {}
                break;

            case "c":
                process.stdout.write(clear);
                try {
                    await fs.unlink("ocr.txt");
                } catch (ex) {}
                break;

            default:
                process.stdout.write(clear);
        }
    }
}
main();

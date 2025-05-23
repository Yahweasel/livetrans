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

const config = require("./config.json");
process.env.GOOGLE_APPLICATION_CREDENTIALS = config.google;

const fs = require("fs/promises");
const sc = require("stream/consumers");
const util = require("util");

const OpenAI = require("openai");
const vision = require("@google-cloud/vision");
const Sharp = require("sharp");

const defaultOpenAIModel = "gpt-4o";
const request =
    config.visionRequest ||
    "Please transcribe the text in this image, in any language. Only give me the transcription, no other context.";

/**
 * OCR in.png using Google Vision.
 */
async function googleVision() {
    const img = await sc.buffer(process.stdin);
    await fs.writeFile("in.png", img);
    const vclient = new vision.ImageAnnotatorClient();
    const ocrR = await vclient.textDetection("in.png");
    return ocrR[0].fullTextAnnotation.text;
}

/**
 * OCR in.png using OpenAI.
 */
async function openAIVision() {
    const openai = new OpenAI({
        apiKey: config.openai,
        baseURL: config.visionBaseURL || void 0
    });
    const model = config.visionModel || defaultOpenAIModel;

    const img = new Sharp(await sc.buffer(process.stdin));
    const jpeg = await img
        .resize(512, 512, {fit: "inside"})
        .toFormat("jpeg", {quality: 91})
        .toBuffer();
    const messages = [{
        role: "user",
        content: [
            {type: "text", text: request},
            {
                type: "image_url",
                image_url: {url: "data:image/jpeg;base64," + jpeg.toString("base64")}
            }
        ]
    }];
    completion = await openai.chat.completions.create({
        model,
        messages
    });
    const msg = completion.choices[0].message;
    return msg.content.replace(/^<think>[\s\S]*<\/think>\s*/, "");
}

async function main() {
    try {
        // OCR the image
        let ocrN;
        if (config.vision === "google")
            ocrN = await googleVision();
        else
            ocrN = await openAIVision();
        ocrN = ocrN.replace(/\n/g, config.inNewline || "\n");

        // Append it to the OCR file
        let ocr = "";
        try {
            ocr = await fs.readFile("ocr.txt", "utf8");
        } catch (ex) {}
        ocr += ocrN;
        await fs.writeFile("ocr.txt", ocr);

        // And display it
        process.stdout.write(ocr);
        process.exit(0);

    } catch (err) {
        console.log("(OCR error)");
        console.log(err.message);
        process.exit(1);

    }
}
main();

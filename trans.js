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
const util = require("util");
const {Translate} = require('@google-cloud/translate').v2;
let gtranslate;
if (config.google && config.googleProjectId)
    gtranslate = new Translate({projectId: config.googleProjectId});
const OpenAI = require("openai");
const wrap = require("word-wrap");

const openai = new OpenAI({
    apiKey: config.openai,
    baseURL: config.translationBaseURL || void 0
});
const defaultOpenAIModel = "gpt-4o";
const model = config.translationModel || defaultOpenAIModel;
const openaiTimeout =
    (typeof config.translationTimeout === "number")
        ? config.translationTimeout
        : 10000;
const requestSuffix = config.translationRequestSuffix || "";

async function main() {
    try {
        const ocr = await fs.readFile("ocr.txt", "utf8");

        /* Start the Google Translate promise in advance so they can run at the
         * same time. */
        let gTransP;
        if (gtranslate)
            gTransP = gtranslate.translate(ocr, {from: config.from, to: "en"});

        // Prepare OpenAI
        let log = {tokens: [], messages: []};
        let messages = log.messages;
        try {
            log = JSON.parse(await fs.readFile("chat.json", "utf8"));
            messages = log.messages;
        } catch (ex) {}

        let completion;
        if (messages.length === 0) {
            // Prime it with the instructions
            messages.push({
                role: "user",
                content: "I am going to give you a sequence of lines of text from a video game. Please translate them into English. Note that this text was created by OCR; if there appear to be any OCR errors, correct for them in your translation. Do you understand?" + requestSuffix
            });
            completion = await openai.chat.completions.create({
                model,
                messages
            });
            const msg = completion.choices[0].message;
            msg.content = msg.content.replace(/^<think>[\s\S]*<\/think>\s*/, "");
            messages.push(msg);
            log.tokens = [
                completion.usage.prompt_tokens,
                completion.usage.completion_tokens
            ];
        }

        // How many tokens have we used so far?
        let totalTokens = 0;
        for (const count of log.tokens)
            totalTokens += count;

        // If it's gotten too long, cut it off
        while (totalTokens >= 1000 && messages.length > 4) {
            totalTokens -= log.tokens[2] + log.tokens[3];
            log.tokens.splice(2, 2);
            messages.splice(2, 2);
        }

        // Now add this line
        messages.push({
            role: "user",
            content: ocr
        });

        // And "translate"
        let translation;
        for (let i = 0; i < 3; i++) {
            let tout;
            if (openaiTimeout)
                tout = new Promise(res => setTimeout(() => res(null), openaiTimeout));
            else
                tout = new Promise(()=>{});
            completion = await Promise.race([
                openai.chat.completions.create({
                    model,
                    messages
                }),
                tout
            ]);
            if (!completion) {
                translation = "(Timeout)";
                break;
            }
            const msg = completion.choices[0].message;
            msg.content = msg.content.replace(/^<think>[\s\S]*<\/think>\s*/, "");
            translation = msg.content;

            // Check for likely failures
            const lc = translation.toLowerCase();
            if (lc[0] !== '"' && lc.indexOf("english") === -1 &&
                lc.indexOf("translation") === -1) {
                break;
            }
        }

        // Save the chat log
        if (completion) {
            log.tokens.push(
                completion.usage.prompt_tokens - totalTokens);
            messages.push(completion.choices[0].message);
            log.tokens.push(
                completion.usage.completion_tokens);
            await fs.writeFile("chat.json", JSON.stringify(log));
        }

        translation = translation.replace(/\n/g, config.outNewline || "\n");

        // Now get the Google translation
        let gText;
        if (gTransP) {
            const gTrans = await gTransP;
            gText = gTrans[0].replace(/\n/g, config.outNewline || "\n");
        }

        // And output
        const ocrNl = ocr.replace(/\n/g, config.outNewline || "\n");
        const width = (+process.env.COLUMNS || process.stdout.columns || 80) - 1;
        const indent = "";
        process.stdout.write(ocrNl + "\n⇒\n" +
            wrap(translation, {width, indent}) + "\n\n");

        if (gText) {
            process.stdout.write(wrap("⟦" + gText + "⟧", {width, indent}) + "\n\n");
        }

        if (translation === "(Timeout)")
            process.exit(1);
        else
            process.exit(0);

    } catch (err) {
        console.log("(Translation error)");
        console.log(err.message);
        process.exit(1);

    }
}

main();

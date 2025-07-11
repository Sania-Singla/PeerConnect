import { BAD_REQUEST, OK, SERVER_ERROR } from '../constants/errorCodes.js';
import { tryCatch } from '../utils/tryCatch.js';
import { z } from 'zod';

const quickBot = tryCatch('bot chat', async (req, res) => {
    const { userInput } = req.body;
    if (!userInput) {
        return res.status(BAD_REQUEST).json({ message: 'User input missing' });
    }

    try {
        const response = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openrouter/openai/gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a helpful assistant that formats all code in proper markdown fenced code blocks, with syntax highlighting hints. Explain technical concepts clearly.',
                        },
                        { role: 'user', content: userInput },
                    ],
                    temperature: 0.7,
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            return res
                .status(response.status)
                .json({ message: errorData.error?.message || 'API error' });
        }

        const data = await response.json();

        // Send back the raw markdown string
        return res.status(OK).json(data.choices[0].message.content);
    } catch (error) {
        console.error('Error in bot chat:', error);
        return res
            .status(SERVER_ERROR)
            .json({ message: 'Internal server error' });
    }
});

// feedback schema
const feedbackSchema = z.object({
    totalScore: z.number(),
    categoryScores: z.array(
        z.object({
            name: z.enum([
                'Communication Skills',
                'Technical Knowledge',
                'Problem-Solving',
                'Cultural & Role Fit',
                'Confidence & Clarity',
            ]),
            score: z.number(),
            comment: z.string(),
        })
    ),
    strengths: z.array(z.string()),
    areasForImprovement: z.array(z.string()),
    finalAssessment: z.string(),
    createdAt: z.string().optional(), // ISO timestamp string
});

const feedback = tryCatch('bot feedback', async (req, res) => {
    const { transcript } = req.body;

    if (!transcript || !Array.isArray(transcript)) {
        return res
            .status(BAD_REQUEST)
            .json({ message: 'Invalid or missing transcript' });
    }

    const formattedTranscript = transcript
        .map(({ role, content }) => `- ${role}: ${content}`)
        .join('\n');

    const prompt = `
You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

Transcript:
${formattedTranscript}

Please score the candidate from 0 to 100 in the following areas:
- Communication Skills
- Technical Knowledge
- Problem-Solving
- Cultural & Role Fit
- Confidence & Clarity

Return the response as a JSON object with these keys:
- totalScore (number),
- categoryScores (array of objects with name, score, comment),
- strengths (array of strings),
- areasForImprovement (array of strings),
- finalAssessment (string)
`;

    const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a professional interviewer analyzing a mock interview.',
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        return res
            .status(response.status)
            .json({ message: errorData.error?.message || 'API error' });
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content.trim();
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/i);
    const jsonString = jsonMatch ? jsonMatch[1] : rawContent;

    let feedbackObj;
    try {
        feedbackObj = JSON.parse(jsonString);
    } catch (err) {
        return res.status(SERVER_ERROR).json({
            message: 'Failed to parse JSON from model response',
            rawResponse: rawContent,
        });
    }

    // Validate the parsed object against your exact schema
    try {
        feedbackSchema.parse(feedbackObj);
    } catch (validationError) {
        return res.status(BAD_REQUEST).json({
            message: 'Validation failed for feedback object',
            details: validationError.errors,
            rawResponse: rawContent,
        });
    }

    // Fill defaults for missing or empty fields
    const fillDefaults = (obj) => ({
        totalScore: typeof obj.totalScore === 'number' ? obj.totalScore : 0,
        categoryScores:
            Array.isArray(obj.categoryScores) && obj.categoryScores.length
                ? obj.categoryScores
                : [
                      {
                          name: 'Communication Skills',
                          score: 0,
                          comment: 'No feedback available.',
                      },
                      {
                          name: 'Technical Knowledge',
                          score: 0,
                          comment: 'No feedback available.',
                      },
                      {
                          name: 'Problem-Solving',
                          score: 0,
                          comment: 'No feedback available.',
                      },
                      {
                          name: 'Cultural & Role Fit',
                          score: 0,
                          comment: 'No feedback available.',
                      },
                      {
                          name: 'Confidence & Clarity',
                          score: 0,
                          comment: 'No feedback available.',
                      },
                  ],
        strengths:
            Array.isArray(obj.strengths) && obj.strengths.length
                ? obj.strengths
                : ['No strengths identified.'],
        areasForImprovement:
            Array.isArray(obj.areasForImprovement) &&
            obj.areasForImprovement.length
                ? obj.areasForImprovement
                : ['No areas for improvement identified.'],
        finalAssessment:
            obj.finalAssessment && obj.finalAssessment.trim()
                ? obj.finalAssessment
                : 'No detailed assessment available.',
    });

    const feedbackWithDefaults = fillDefaults(feedbackObj);

    // Add createdAt timestamp
    const feedbackWithTimestamp = {
        ...feedbackWithDefaults,
        createdAt: new Date().toISOString(),
    };

    return res.status(OK).json(feedbackWithTimestamp);
});

export { quickBot, feedback };

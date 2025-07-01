import { createTransport } from "nodemailer";

export class Mail {
    /** Gmail SMTP를 이용해 HTML 형식의 데이터를 주어진 이메일로 비동기 전송합니다. */
    static async sendHTML(
        email: string,
        title: string,
        contents: string,
    ) {
        const transporter = createTransport({
            host: "smtp.gmail.com",
            port: 587,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: title,
            html: contents
        });
    }

    static async sendAuthNumbers(
        title: string,
        email: string,
        authNums: string
    ) {
        return await Mail.sendHTML(email, title, authNums);
    }
}
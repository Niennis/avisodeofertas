import nodemailer, { type Transporter } from "nodemailer";
import type { Deal, Notifier } from "@/core/application/ports/notifier";
import type { StoreFailures } from "@/core/domain/failures";
import { dealEmailHtml, dealEmailSubject, dealEmailText } from "./deal-email";
import { failureEmailHtml, failureEmailSubject, failureEmailText } from "./failure-email";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Envía los avisos por SMTP. Sirve con Gmail (contraseña de aplicación),
 * Resend, Brevo o cualquier otro proveedor SMTP.
 */
export class SmtpNotifier implements Notifier {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    private readonly appUrl: string | null,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async sendDeals(to: string, deals: Deal[]): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: dealEmailSubject(deals),
      text: dealEmailText(deals, this.appUrl),
      html: dealEmailHtml(deals, this.appUrl),
    });
  }

  async sendFailureReport(to: string, stores: StoreFailures[]): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: failureEmailSubject(stores),
      text: failureEmailText(stores, this.appUrl),
      html: failureEmailHtml(stores, this.appUrl),
    });
  }
}

/** Para desarrollo: muestra el aviso en la consola en vez de enviarlo. */
export class ConsoleNotifier implements Notifier {
  async sendDeals(to: string, deals: Deal[]): Promise<void> {
    console.log(`\n[email simulado] Para: ${to}\nAsunto: ${dealEmailSubject(deals)}\n${dealEmailText(deals, null)}\n`);
  }

  async sendFailureReport(to: string, stores: StoreFailures[]): Promise<void> {
    console.log(`\n[email simulado] Para: ${to}\nAsunto: ${failureEmailSubject(stores)}\n${failureEmailText(stores, null)}\n`);
  }
}

import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
// node-forge ships its own .d.ts in v1.3+; if not available, declare minimally.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as forge from 'node-forge';

/**
 * X.509 PKCS#7 detached signature signer for UBL 2.1 JSON documents.
 *
 * The MyInvois SDK mandates that every e-invoice document be signed with an
 * X.509 certificate that has the "Document Signing" Extended Key Usage (EKU).
 * The signing process produces a CMS/PKCS#7 signature that is appended to
 * the JSON payload in the `DocumentSignature` element.
 *
 * For local development and CI we provide:
 *   1. A "no-op" signer that returns a deterministic placeholder signature
 *      (use only when env DISABLE_SIGNING=1).
 *   2. A real PKCS#7 signer that reads a .p12 / .pfx file using node-forge.
 */
export interface SigningResult {
  /** Base64-encoded PKCS#7 detached signature. */
  signature: string;
  /** SHA-256 digest of the unsigned JSON document (hex). */
  digest: string;
}

interface CertExtension {
  id: string;
  value: string;
  critical?: boolean;
  name?: string;
}

@Injectable()
export class JsonSigner {
  /**
   * Sign an arbitrary JSON document using a PKCS#12 (.p12 / .pfx) certificate.
   *
   * @param payload The canonical JSON string of the UBL 2.1 document.
   * @param p12Path Path to the .p12 file inside the container.
   * @param passphrase Passphrase for the .p12 file.
   */
  async signP12(payload: string, p12Path: string, passphrase: string): Promise<SigningResult> {
    const fs = await import('fs/promises');
    const p12Buffer = await fs.readFile(p12Path);
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!certBag?.cert || !keyBag) {
      throw new Error('P12 file missing certificate or private key');
    }

    this.assertDocumentSigningEku(certBag.cert);

    const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(payload, 'utf8');
    p7.addCertificate(certBag.cert);
    p7.addSigner({
      key: keyBag.key as forge.pki.rsa.PrivateKey,
      certificate: certBag.cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest, value: digest },
        { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
      ],
    });
    p7.sign({ detached: true });
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const signature = Buffer.from(der, 'binary').toString('base64');

    return { signature, digest };
  }

  /**
   * Build a placeholder signature for local dev / CI. The MyInvois sandbox
   * rejects unsigned documents, so this is gated on env DISABLE_SIGNING=1.
   */
  placeholder(payload: string): SigningResult {
    const digest = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    const signature = Buffer.from(
      JSON.stringify({ placeholder: true, digest, ts: new Date().toISOString() }),
      'utf8',
    ).toString('base64');
    return { signature, digest };
  }

  /**
   * Throw if the certificate's EKU doesn't allow document signing.
   * Accepts Document Signing (1.3.6.1.5.5.7.3.36) or Non-Repudiation
   * (1.3.6.1.5.5.7.3.2) since MyInvois uses Document Signing per their
   * SDK guide.
   */
  private assertDocumentSigningEku(cert: forge.pki.Certificate): void {
    const ekuExt = cert.extensions.find((e: CertExtension) => e.id === forge.pki.oids.extKeyUsage);
    if (!ekuExt) {
      return;
    }
    const usages = ((ekuExt as { value: string }).value || '').toLowerCase();
    const allowed = ['documentsigning', '1.3.6.1.5.5.7.3.36', 'nonrepudiation', '1.3.6.1.5.5.7.3.2'];
    if (!allowed.some((a) => usages.includes(a))) {
      throw new Error(
        'Certificate EKU does not include Document Signing / Non-Repudiation. ' +
          'MyInvois will reject this submission. Please use a certificate ' +
          'with Document Signing EKU (1.3.6.1.5.5.7.3.36) or Non-Repudiation.',
      );
    }
  }
}

import { ReceiptData } from '../types.ts';

export async function appendToGoogleSheet(webhookUrl: string, receipts: ReceiptData[], month: string) {
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'append',
        month,
        data: receipts.map(r => ({
          id: r.id,
          tarih: r.date,
          market: r.vendor,
          kategori: r.category,
          toplam: r.total,
          items: JSON.stringify(r.items),
          driveUrl: r.driveUrl || ''
        }))
      }),
    });
    return true;
  } catch (error) {
    console.error('Google Sheet Sync Error:', error);
    return false;
  }
}

export async function importAllFromWebhook(webhookUrl: string): Promise<ReceiptData[] | null> {
  if (!webhookUrl) return null;
  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Webhook Import Error:', error);
    return null;
  }
}

export async function exportAllToWebhook(webhookUrl: string, receipts: ReceiptData[]) {
  if (!webhookUrl) return false;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', data: receipts })
    });
    return response.ok;
  } catch (error) {
    console.error('Webhook Export Error:', error);
    return false;
  }
}

export async function uploadImageToDrive(webhookUrl: string, base64Image: string, fileName: string) {
  if (!webhookUrl) return null;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upload',
        fileName,
        fileData: base64Image.split(',')[1] || base64Image
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.url;
    }
    return null;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    return null;
  }
}

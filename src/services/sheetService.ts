import { ReceiptData } from '../types.ts';

export async function appendToGoogleSheet(webhookUrl: string, receipts: ReceiptData[], month: string) {
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors', // Webhooklar genelde CORS desteklemez, no-cors ile gönderiyoruz
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

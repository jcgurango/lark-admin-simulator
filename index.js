const puppeteer = require('puppeteer');

const adminLogin = async (
  onQrCode = (code) => { },
  onLoggedIn = (page) => { },
  {
    tenantId = null,
  } = {},
) => {
  const browser = await puppeteer.launch();

  try {
    let qrId = null;
    const page = await browser.newPage();

    page.on('requestfinished', (req) => {
      if (req.url().indexOf('qrlogin/init') > -1) {
        req.response().json().then(({ data: { qr_code } }) => {
          qrId = qr_code;
        });
      }
    });

    await page.goto('https://www.larksuite.com/admin', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.switch-login-mode-box');
    await page.evaluate('document.querySelector(".switch-login-mode-box").click();');
    await page.waitForSelector('.newLogin_scan-QR-code-show canvas');

    await new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (qrId) {
          resolve(qrId);
          clearInterval(interval);
        }
      }, 100);
    });

    onQrCode(JSON.stringify({
      qrlogin: {
        token: qrId,
      }
    }));

    await page.waitForNavigation({ timeout: 5 * 60 * 1000 });
    let pageContent = await page.content();

    if (pageContent.indexOf('Sorry, you don\'t have permission.') > -1) {
      if (tenantId) {
        await page.waitForSelector("[data-id='" + tenantId + "']");
        await page.evaluate(function (tenantId) {
          document.querySelector("[data-id='" + tenantId + "']").click();
        }, [tenantId]);

        await page.waitForNavigation();

        pageContent = await page.content();

        if (pageContent.indexOf('Sorry, you don\'t have permission.') > -1) {
          throw new Error('Tenant unauthorized.');
        }
      } else {
        throw new Error('Unauthorized.');
      }
    }

    await onLoggedIn(page);
    await browser.close();
  } catch (e) {
    await browser.close();
    throw e;
  }
};

module.exports = {
  adminLogin,
};

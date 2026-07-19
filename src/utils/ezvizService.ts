export async function getEzvizToken(appKey?: string, appSecret?: string) {
  const finalKey = appKey?.trim() || (process.env.EZVIZ_APP_KEY as string) || "";
  const finalSecret = appSecret?.trim() || (process.env.EZVIZ_APP_SECRET as string) || "";

  if (!finalKey || !finalSecret) {
    throw new Error("缺少 EZVIZ AppKey 或 AppSecret，请在设备管理设置或后台环境变量中进行配置。");
  }

  const response = await fetch("https://open.ys7.com/api/lapp/token/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      appKey: finalKey,
      appSecret: finalSecret,
    }).toString(),
  });

  const data = await response.json();
  if (data.code === "200" && data.data) {
    return data.data;
  } else {
    throw new Error(data.msg || `EZVIZ Token API 错误 (code: ${data.code})`);
  }
}

export async function getEzvizDevices(accessToken: string) {
  if (!accessToken) {
    throw new Error("缺少 EZVIZ AccessToken，请先获取授权。");
  }

  const response = await fetch("https://open.ys7.com/api/lapp/device/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      accessToken: accessToken.trim(),
      pageStart: "0",
      pageSize: "50",
    }).toString(),
  });

  const data = await response.json();
  if (data.code === "200") {
    return data.data;
  } else {
    throw new Error(data.msg || `EZVIZ Device List API 错误 (code: ${data.code})`);
  }
}

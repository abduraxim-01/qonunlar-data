const MCP_SERVER_URL = "https://qonunlar-api-copy-copy-production.up.railway.app/api/sse";
const SESSION_ID = "test-session";

async function testMcpServer() {
  console.log("MCP serverga ulanish va tool'larni tekshirish...");

  // 1. SSE ulanishini o'rnatish (GET so'rovi)
  console.log("GET /api/sse ga ulanish...");
  const sseResponse = await fetch(`${MCP_SERVER_URL}?sessionId=${SESSION_ID}`);
  if (!sseResponse.ok) {
    console.error(`GET /api/sse xatosi: ${sseResponse.status} ${sseResponse.statusText}`);
    return;
  }
  console.log("GET /api/sse muvaffaqiyatli. Endi tool'larni so'raymiz...");

  // Qisqa kutish, server SSE ulanishini o'rnata olishi uchun
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. Tool'lar ro'yxatini so'rash (POST so'rovi)
  try {
    const listToolsResponse = await fetch(`${MCP_SERVER_URL}?sessionId=${SESSION_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        type: "ListToolsRequest",
        params: {}
      })
    });

    if (!listToolsResponse.ok) {
      console.error(`POST /api/sse (ListToolsRequest) xatosi: ${listToolsResponse.status} ${listToolsResponse.statusText}`);
      const errorText = await listToolsResponse.text();
      console.error("Xato javobi:", errorText);
      return;
    }

    const toolsData = await listToolsResponse.json();
    console.log("Tool'lar ro'yxati:", JSON.stringify(toolsData, null, 2));

  } catch (error) {
    console.error("Tool'larni so'rashda xatolik yuz berdi:", error);
  }
}

testMcpServer();
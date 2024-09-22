import { NextResponse } from "next/server";
import runpodSdk from "runpod-sdk";

const runpod = runpodSdk('3S0XGZVIO0MYEWP9EFVVQRWO32DB5HU686MS2LHU');
const endpoint = runpod.endpoint('2fn2m5qgq3dpay');

export async function POST(request: Request) {
    const { id } = await request.json();

    if (!endpoint) {
        return NextResponse.json({ error: 'No endpoint available' }, { status: 500 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            for await (const result of endpoint.stream(id)) {
                console.log(result);
                
                // 发送数据块到客户端
                controller.enqueue(JSON.stringify(result) + '\n');
                
                if (result.output.status === 'finish' || result.output.status === 'Error') {
                    // 当流结束或发生错误时关闭流
                    controller.close();
                    break;
                }
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
        },
    });
}

import { NextResponse } from "next/server";
import runpodSdk from "runpod-sdk";

const runpod = runpodSdk('3S0XGZVIO0MYEWP9EFVVQRWO32DB5HU686MS2LHU');
const endpoint = runpod.endpoint('2fn2m5qgq3dpay');

export async function POST(request: Request) {
    const {id } = await request.json();

    if (!endpoint) {
        return NextResponse.json({ error: 'No endpoint available' }, { status: 500 });
    }
    try {
        const result = await endpoint.status(id);
        return NextResponse.json({ ...result }, { status: 200 });
    }
    catch (error: any) {
        console.log(error);
        if (error.message === 'timeout of 3000ms exceeded') {
            return NextResponse.json({ error: { err_code: -1024, error } }, { status: 200 });
        } else if(error.status === 401) {
            return NextResponse.json({ error: { err_code: -10002, error } }, { status: 200 });
        } else {
            return NextResponse.json({ error }, { status: 200 });
        }
    }
}


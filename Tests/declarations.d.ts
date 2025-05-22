declare module '@sitespeed.io/throttle' {

    const throttle: any; // or: () => any
    export default throttle;

    export async function start(throttlingSettings: {});
    export async function stop();
}
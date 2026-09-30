/** Parse API responses without exposing hosting error pages to visitors. */
export async function readAPIResponse(response:Response){
 const unavailable='This service is unavailable. Please try again later. You can still use the resume builder and download a PDF.';
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error(unavailable);
 let data;
 try{data=await response.json()}catch{throw new Error(unavailable)}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error(unavailable);
 return data;
}

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
	region: "auto",
	endpoint: "https://6c1b0cf31ab617ca957a87b56b144763.r2.cloudflarestorage.com",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
});

export { r2Client };

export async function uploadToR2(file: File, key: string): Promise<string> {
	const buffer = Buffer.from(await file.arrayBuffer());

	await r2Client.send(
		new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: key,
			Body: buffer,
			ContentType: file.type,
		})
	);

	// Return the public URL
	return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function uploadFromUrl(
	imageUrl: string,
	key: string
): Promise<string> {
	try {
		// Fetch the image from the URL
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`);
		}

		const buffer = Buffer.from(await response.arrayBuffer());
		const contentType = response.headers.get("content-type") || "image/jpeg";

		await r2Client.send(
			new PutObjectCommand({
				Bucket: process.env.R2_BUCKET_NAME,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			})
		);

		// Return the public URL
		return `${process.env.R2_PUBLIC_URL}/${key}`;
	} catch (error) {
		console.error("Error uploading from URL:", error);
		throw error;
	}
}

export async function deleteFileFromR2(key: string) {
	await r2Client.send(new DeleteObjectCommand({
		Bucket: process.env.R2_BUCKET_NAME,
		Key: key,
	}));
}
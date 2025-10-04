import { CentralaService } from "./CentralaService";
import { OpenAIService } from "./OpenAIService";

(async () => {
  // Get the image description from the API
  const description = await CentralaService.fetchRobotDescription();
  console.log("Image description:", description);

  // Generate the image and get the URL
  const openaiService = new OpenAIService();
  const imageUrl =
    await openaiService.generateImageFromDescription(description);
  console.log("Generated image URL:", imageUrl);

  // Send the image URL as the answer for a generic task
  const response = await CentralaService.send("robotid", imageUrl);
  console.log("Send response:", response);

  return response;
})();

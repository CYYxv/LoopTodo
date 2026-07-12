import { IsIn } from 'class-validator';
import { reactionEmojis } from '../social.policy';
export class SendReactionDto { @IsIn([...reactionEmojis]) emoji!: string; }
